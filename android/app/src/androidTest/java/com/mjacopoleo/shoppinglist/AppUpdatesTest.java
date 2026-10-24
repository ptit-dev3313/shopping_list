package com.mjacopoleo.shoppinglist;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.File;
import java.io.FileInputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.security.MessageDigest;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

@RunWith(AndroidJUnit4.class)
public class AppUpdatesTest {
    private static class Result extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1);
        volatile String error;
        Result(String method, JSObject data) { super(null, "AppUpdates", "native-update-test", method, data); }
        @Override public void resolve() { done.countDown(); }
        @Override public void reject(String message) { error = message; done.countDown(); }
        void await() throws Exception { assertTrue("Native callback timed out", done.await(150, TimeUnit.SECONDS)); }
    }

    @Test public void refusesUntrustedUrlBeforeDownloading() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Result call = new Result("downloadUpdate", new JSObject().put("url", "https://evil.example/Courses.apk").put("sha256", "0000000000000000000000000000000000000000000000000000000000000000"));
            scenario.onActivity(activity -> ((AppUpdatesPlugin) activity.getBridge().getPlugin("AppUpdates").getInstance()).downloadUpdate(call));
            call.await();
            assertNotNull(call.error);
            assertTrue(call.error.contains("invalides"));
        }
    }

    @Test public void refusesCorruptHashAndAlreadyInstalledVersion() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AppUpdatesPlugin[] plugin = new AppUpdatesPlugin[1];
            scenario.onActivity(activity -> plugin[0] = (AppUpdatesPlugin) activity.getBridge().getPlugin("AppUpdates").getInstance());
            File apk = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationInfo().sourceDir);
            Method verify = AppUpdatesPlugin.class.getDeclaredMethod("verify", File.class, String.class);
            verify.setAccessible(true);
            try { verify.invoke(plugin[0], apk, "invalid"); fail("Corrupt digest accepted"); }
            catch (InvocationTargetException expected) { assertTrue(expected.getCause().getMessage().contains("altéré")); }
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(apk)) {
                byte[] buffer = new byte[32768]; int count;
                while ((count = input.read(buffer)) != -1) hash.update(buffer, 0, count);
            }
            StringBuilder digest = new StringBuilder();
            for (byte value : hash.digest()) digest.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            try { verify.invoke(plugin[0], apk, digest.toString()); fail("Same version accepted"); }
            catch (InvocationTargetException expected) { assertTrue(expected.getCause().getMessage().contains("déjà installée")); }
        }
    }

    // Optional device QA: supply an official newer APK URL and its GitHub SHA-256.
    // The host checks the Android permission screen, grants it and returns to Courses.
    @Test public void downloadsVerifiesAndOpensAndroidInstaller() throws Exception {
        String url = InstrumentationRegistry.getArguments().getString("updateUrl");
        String digest = InstrumentationRegistry.getArguments().getString("updateSha256");
        assumeTrue(url != null && digest != null);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Result download = new Result("downloadUpdate", new JSObject().put("url", url).put("sha256", digest));
            scenario.onActivity(activity -> ((AppUpdatesPlugin) activity.getBridge().getPlugin("AppUpdates").getInstance()).downloadUpdate(download));
            download.await(); assertNull(download.error);
            Result install = new Result("installUpdate", new JSObject());
            scenario.onActivity(activity -> ((AppUpdatesPlugin) activity.getBridge().getPlugin("AppUpdates").getInstance()).installUpdate(install));
            install.await(); assertNull(install.error);
        }
    }
}
