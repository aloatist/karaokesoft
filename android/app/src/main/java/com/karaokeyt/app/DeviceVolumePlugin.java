package com.karaokeyt.app;

import android.content.Context;
import android.database.ContentObserver;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceVolume")
public class DeviceVolumePlugin extends Plugin {
  private AudioManager audioManager;
  private ContentObserver volumeObserver;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private int lastPercent = -1;

  @Override
  public void load() {
    audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    getActivity().setVolumeControlStream(AudioManager.STREAM_MUSIC);
    registerVolumeObserver();
    lastPercent = getVolumePercent();
  }

  @Override
  protected void handleOnResume() {
    super.handleOnResume();
    getActivity().setVolumeControlStream(AudioManager.STREAM_MUSIC);
    emitVolumeIfChanged();
  }

  @Override
  protected void handleOnDestroy() {
    unregisterVolumeObserver();
    super.handleOnDestroy();
  }

  @PluginMethod
  public void getVolume(PluginCall call) {
    call.resolve(readVolume());
  }

  @PluginMethod
  public void setVolume(PluginCall call) {
    Integer percentValue = call.getInt("percent");
    if (percentValue == null) {
      call.reject("Missing percent");
      return;
    }

    boolean showUi = Boolean.TRUE.equals(call.getBoolean("showUi", false));
    int percent = clamp(percentValue, 0, 100);
    int maxVolume = Math.max(1, audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
    int nextVolume = Math.round((percent / 100f) * maxVolume);
    int flags = showUi ? AudioManager.FLAG_SHOW_UI : 0;

    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, clamp(nextVolume, 0, maxVolume), flags);
    mainHandler.postDelayed(this::emitVolumeIfChanged, 80);
    call.resolve(readVolume());
  }

  private void registerVolumeObserver() {
    if (volumeObserver != null) return;

    volumeObserver = new ContentObserver(mainHandler) {
      @Override
      public void onChange(boolean selfChange) {
        super.onChange(selfChange);
        emitVolumeIfChanged();
      }
    };

    getContext().getContentResolver().registerContentObserver(Settings.System.CONTENT_URI, true, volumeObserver);
  }

  private void unregisterVolumeObserver() {
    if (volumeObserver == null) return;
    getContext().getContentResolver().unregisterContentObserver(volumeObserver);
    volumeObserver = null;
  }

  private void emitVolumeIfChanged() {
    int percent = getVolumePercent();
    if (percent == lastPercent) return;
    lastPercent = percent;
    notifyListeners("volumeChange", readVolume());
  }

  private JSObject readVolume() {
    int maxVolume = Math.max(1, audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
    int currentVolume = clamp(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC), 0, maxVolume);
    int percent = Math.round((currentVolume * 100f) / maxVolume);

    JSObject result = new JSObject();
    result.put("percent", clamp(percent, 0, 100));
    result.put("current", currentVolume);
    result.put("max", maxVolume);
    return result;
  }

  private int getVolumePercent() {
    int maxVolume = Math.max(1, audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
    int currentVolume = clamp(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC), 0, maxVolume);
    return clamp(Math.round((currentVolume * 100f) / maxVolume), 0, 100);
  }

  private static int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }
}
