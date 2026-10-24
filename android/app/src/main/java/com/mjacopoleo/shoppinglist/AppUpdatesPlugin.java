package com.mjacopoleo.shoppinglist;

import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdates")
public class AppUpdatesPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private static final long MAX_BYTES = 100L * 1024 * 1024;

    private SharedPreferences metadata() { return getContext().getSharedPreferences("app_updates", 0); }
    private File apkFile() { return new File(getContext().getCacheDir(), "updates/Courses.apk"); }

    private boolean validRequest(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && "github.com".equals(uri.getHost()) &&
            uri.getUserInfo() == null && uri.getPort() == -1 && uri.getQuery() == null && uri.getFragment() == null &&
            path != null && path.matches("/ptit-dev3313/shopping_list/releases/download/v?\\d+\\.\\d+\\.\\d+/Courses\\.apk") &&
            call.getString("sha256", "").matches("[a-f0-9]{64}");
    }

    private void progress(String url, int percent, String phase) {
        JSObject event = new JSObject();
        event.put("url", url); event.put("percent", percent); event.put("phase", phase);
        notifyListeners("downloadProgress", event);
    }

    // GitHub redirects release assets to its dedicated HTTPS asset hosts.
    private HttpURLConnection connect(String value) throws Exception {
        URL url = new URL(value);
        for (int redirects = 0; redirects < 5; redirects++) {
            String host = url.getHost();
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || url.getPort() != -1 ||
                !(host.equals("github.com") || host.equals("release-assets.githubusercontent.com") || host.equals("objects.githubusercontent.com"))) {
                throw new Exception("Redirection de téléchargement refusée.");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(20000); connection.setReadTimeout(20000);
            connection.setRequestProperty("Accept", "application/octet-stream");
            connection.setRequestProperty("User-Agent", "Courses-Android-Updater");
            int status = connection.getResponseCode();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new Exception("Redirection manquante.");
                url = new URL(url, location);
            } else if (status == 200) {
                return connection;
            } else {
                connection.disconnect();
                throw new Exception("Téléchargement indisponible (" + status + "). Réessayez plus tard.");
            }
        }
        throw new Exception("Trop de redirections.");
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder hex = new StringBuilder();
        for (byte value : digest.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return hex.toString();
    }

    @SuppressWarnings("deprecation")
    private void verify(File file, String digest) throws Exception {
        if (!file.isFile() || !digest.equals(sha256(file))) throw new Exception("Le fichier est incomplet ou altéré. Téléchargez-le à nouveau.");
        PackageManager manager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(getContext().getPackageName(), flags);
        if (candidate == null || !installed.packageName.equals(candidate.packageName)) throw new Exception("Ce fichier ne correspond pas à Courses.");
        long candidateCode = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
        long installedCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        if (candidateCode <= installedCode) throw new Exception("Cette version est déjà installée ou plus ancienne.");
        Signature[] next = Build.VERSION.SDK_INT >= 28 && candidate.signingInfo != null ? candidate.signingInfo.getApkContentsSigners() : candidate.signatures;
        Signature[] previous = Build.VERSION.SDK_INT >= 28 && installed.signingInfo != null ? installed.signingInfo.getApkContentsSigners() : installed.signatures;
        if (next == null || previous == null || next.length == 0 || !new HashSet<>(Arrays.asList(next)).equals(new HashSet<>(Arrays.asList(previous)))) {
            throw new Exception("La signature de cette mise à jour ne correspond pas à Courses.");
        }
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        if (!validRequest(call)) { call.reject("Informations de mise à jour invalides. Vérifiez à nouveau les versions."); return; }
        if (!downloading.compareAndSet(false, true)) { call.reject("Un téléchargement est déjà en cours."); return; }
        worker.execute(() -> {
            File apk = apkFile(); File partial = new File(apk.getParentFile(), "Courses.part");
            String url = call.getString("url"); String digest = call.getString("sha256");
            try {
                if (apk.isFile() && url.equals(metadata().getString("url", "")) && digest.equals(metadata().getString("sha256", ""))) {
                    try { verify(apk, digest); call.resolve(); return; }
                    catch (Exception ignored) { apk.delete(); }
                }
                if (!apk.getParentFile().isDirectory() && !apk.getParentFile().mkdirs()) throw new Exception("Stockage de téléchargement indisponible.");
                metadata().edit().clear().apply();
                progress(url, 0, "downloading");
                HttpURLConnection connection = connect(url);
                try {
                    long size = connection.getContentLengthLong();
                    if (size > MAX_BYTES) throw new Exception("Fichier de mise à jour trop volumineux.");
                    try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                        byte[] buffer = new byte[32768]; long total = 0; int count; int last = -1;
                        long deadline = System.currentTimeMillis() + 180000;
                        while ((count = input.read(buffer)) != -1) {
                            total += count;
                            if (total > MAX_BYTES || System.currentTimeMillis() > deadline || Thread.currentThread().isInterrupted()) throw new Exception("Téléchargement interrompu. Réessayez.");
                            output.write(buffer, 0, count);
                            int percent = size > 0 ? (int) Math.min(99, total * 100 / size) : 0;
                            if (percent != last) { progress(url, percent, "downloading"); last = percent; }
                        }
                        output.getFD().sync();
                    }
                } finally { connection.disconnect(); }
                progress(url, 100, "verifying");
                verify(partial, digest);
                if (apk.exists() && !apk.delete()) throw new Exception("Impossible de remplacer le précédent téléchargement.");
                if (!partial.renameTo(apk)) throw new Exception("Impossible de conserver le téléchargement.");
                metadata().edit().putString("url", url).putString("sha256", digest).apply();
                call.resolve();
            } catch (Exception exception) {
                partial.delete();
                call.reject(exception.getMessage() != null ? exception.getMessage() : "Téléchargement impossible. Vérifiez votre connexion.");
            } finally { downloading.set(false); }
        });
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        if (downloading.get()) { call.reject("Le téléchargement est encore en cours."); return; }
        worker.execute(() -> {
            try {
                verify(apkFile(), metadata().getString("sha256", ""));
                getActivity().runOnUiThread(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                            startActivityForResult(call, settings, "installationPermissionResult");
                        } else { openInstaller(call); }
                    } catch (Exception exception) { call.reject("Impossible d’ouvrir les réglages d’installation Android."); }
                });
            } catch (Exception exception) { call.reject(exception.getMessage()); }
        });
    }

    @ActivityCallback
    private void installationPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Autorisation non accordée. Vous pouvez réessayer sans télécharger à nouveau.");
            return;
        }
        // Recheck the cached file after leaving and returning to the app.
        installUpdate(call);
    }

    private void openInstaller(PluginCall call) {
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apkFile());
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("Courses", uri));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception exception) { call.reject("Installateur Android indisponible sur cet appareil."); }
    }

    @Override
    protected void handleOnDestroy() { worker.shutdownNow(); }
}
