package com.karaokeyt.app;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(DeviceVolumePlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    boolean handled = super.dispatchKeyEvent(event);
    if (
      event.getAction() == KeyEvent.ACTION_UP &&
      (event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_UP || event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN) &&
      getBridge() != null
    ) {
      getBridge().triggerWindowJSEvent("karaokeytDeviceVolumeKey");
    }
    return handled;
  }
}
