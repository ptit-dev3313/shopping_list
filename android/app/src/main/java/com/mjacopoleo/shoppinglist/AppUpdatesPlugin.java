package com.mjacopoleo.shoppinglist;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppUpdates")
public class AppUpdatesPlugin extends Plugin {
    @PluginMethod
    public void openDownload(PluginCall call) {
        String value = call.getString("url", "");
        Uri uri = Uri.parse(value);
        String path = uri.getPath();
        if (!"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost()) ||
            uri.getUserInfo() != null || uri.getPort() != -1 || uri.getQuery() != null || uri.getFragment() != null ||
            path == null || !path.matches("/ptit-dev3313/shopping_list/releases/download/v?\\d+\\.\\d+\\.\\d+/Courses\\.apk")) {
            call.reject("Invalid update URL");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("No browser available to download the update");
        }
    }
}
