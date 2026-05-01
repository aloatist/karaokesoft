import AVFoundation
import Capacitor
import MediaPlayer
import UIKit

@objc(DeviceVolumePlugin)
public class DeviceVolumePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeviceVolumePlugin"
    public let jsName = "DeviceVolume"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise)
    ]

    private var volumeObservation: NSKeyValueObservation?
    private var volumeView: MPVolumeView?
    private weak var volumeSlider: UISlider?
    private var lastPercent = -1

    @objc override public func load() {
        super.load()
        configureAudioSession()
        installHiddenVolumeView()
        observeSystemVolume()
        lastPercent = readPercent()
    }

    @objc func getVolume(_ call: CAPPluginCall) {
        call.resolve(readVolume())
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        guard let percentValue = call.getInt("percent") else {
            call.reject("Missing percent")
            return
        }

        let percent = clamp(percentValue, min: 0, max: 100)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.installHiddenVolumeView()
            self.volumeSlider?.setValue(Float(percent) / 100, animated: false)
            self.volumeSlider?.sendActions(for: .touchUpInside)
            self.lastPercent = percent
            self.notifyListeners("volumeChange", data: self.readVolume())
            call.resolve(self.readVolume())
        }
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            CAPLog.print("DeviceVolume iOS audio session error: \(error.localizedDescription)")
        }
    }

    private func installHiddenVolumeView() {
        if volumeView != nil { return }

        let frame = CGRect(x: -1000, y: -1000, width: 1, height: 1)
        let view = MPVolumeView(frame: frame)
        view.isHidden = false
        view.alpha = 0.01

        let attach = { [weak self] in
            guard let self = self else { return }
            self.bridge?.viewController?.view.addSubview(view)
            self.volumeView = view
            self.volumeSlider = view.subviews.compactMap { $0 as? UISlider }.first
        }

        if Thread.isMainThread {
            attach()
        } else {
            DispatchQueue.main.async(execute: attach)
        }
    }

    private func observeSystemVolume() {
        volumeObservation = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async {
                self?.emitVolumeIfChanged()
            }
        }
    }

    private func emitVolumeIfChanged() {
        let percent = readPercent()
        if percent == lastPercent { return }
        lastPercent = percent
        notifyListeners("volumeChange", data: readVolume())
    }

    private func readVolume() -> [String: Any] {
        let percent = readPercent()
        return [
            "percent": percent,
            "current": percent,
            "max": 100
        ]
    }

    private func readPercent() -> Int {
        clamp(Int(round(AVAudioSession.sharedInstance().outputVolume * 100)), min: 0, max: 100)
    }

    private func clamp(_ value: Int, min: Int, max: Int) -> Int {
        Swift.max(min, Swift.min(max, value))
    }
}
