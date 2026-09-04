import ExpoModulesCore
import Speech
import AVFoundation

// On-device speech-to-text via Apple's Speech framework (SFSpeechRecognizer) +
// AVAudioEngine for the mic. Free, no API key, no per-use cost; forces on-device
// recognition where supported (private + offline). Streams partial results via the
// "onResult" event and signals completion via "onEnd". iOS only — on Android the
// module is absent and JS falls back to simulated dictation.
public class SpeechRecognizerModule: Module {
  private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
  private var audioEngine: AVAudioEngine?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var ended = false       // guards onEnd so it fires at most once per session
  private var isDestroyed = false // don't resolve promises after teardown

  public func definition() -> ModuleDefinition {
    Name("SpeechRecognizer")

    Events("onResult", "onError", "onEnd")

    // Recognizer present + currently usable.
    Function("isAvailable") { () -> Bool in
      self.recognizer?.isAvailable ?? false
    }

    // Request Speech + microphone authorization. Resolves true only if both granted.
    AsyncFunction("requestPermissions") { (promise: Promise) in
      SFSpeechRecognizer.requestAuthorization { speechStatus in
        let speechOK = speechStatus == .authorized
        AVAudioSession.sharedInstance().requestRecordPermission { micOK in
          DispatchQueue.main.async {
            if self.isDestroyed { return }
            promise.resolve(speechOK && micOK)
          }
        }
      }
    }

    // Begin streaming recognition. Partial transcripts arrive on "onResult".
    AsyncFunction("start") { (promise: Promise) in
      DispatchQueue.main.async {
        if self.isDestroyed { return }
        do {
          try self.startRecognition()
          promise.resolve(nil)
        } catch {
          // Roll back anything startRecognition set up before failing (audio
          // session, tap, task) — otherwise the mic session stays active with
          // nothing listening (the orange dot) until the next start().
          self.teardown(emitEnd: false)
          self.sendEvent("onError", ["message": error.localizedDescription])
          promise.reject("E_SPEECH_START", error.localizedDescription)
        }
      }
    }

    // Stop feeding audio; the recognizer emits its final result, then "onEnd".
    Function("stop") {
      DispatchQueue.main.async { self.finishAudio() }
    }

    OnDestroy {
      self.isDestroyed = true
      self.teardown(emitEnd: false)
    }
  }

  private func startRecognition() throws {
    teardown(emitEnd: false)
    ended = false

    guard let recognizer = recognizer, recognizer.isAvailable else {
      throw NSError(domain: "SpeechRecognizer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Speech recognizer unavailable"])
    }

    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    let req = SFSpeechAudioBufferRecognitionRequest()
    req.shouldReportPartialResults = true
    // Leave requiresOnDeviceRecognition = false: the system uses on-device recognition
    // automatically when its model is ready, and falls back to Apple's (free) server
    // transcription otherwise — forcing on-device silently fails before the model
    // downloads, which reads as "didn't catch that". Either path is free, no API key.
    request = req

    let engine = AVAudioEngine()
    audioEngine = engine
    let inputNode = engine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    // Without mic permission the input node reports a 0-channel format, and
    // installTap raises an uncatchable NSException — bail out with a real error.
    guard format.channelCount > 0 else {
      throw NSError(
        domain: "SpeechRecognizer", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Microphone input unavailable (permission denied?)"])
    }
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }

    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      // Speech invokes this on an internal background queue; all state it touches
      // (ended/audioEngine/request/task) is owned by the main queue — hop over.
      DispatchQueue.main.async {
        guard let self = self else { return }
        if let result = result {
          self.sendEvent("onResult", [
            "transcript": result.bestTranscription.formattedString,
            "isFinal": result.isFinal,
          ])
          if result.isFinal {
            self.teardown(emitEnd: true)
          }
        }
        if let error = error {
          // A cancel/endAudio also surfaces here; only report genuine failures
          // (216 = request canceled, and only in Speech's own error domain).
          let ns = error as NSError
          let canceled = ns.domain == "kAFAssistantErrorDomain" && ns.code == 216
          if !canceled {
            self.sendEvent("onError", ["message": error.localizedDescription])
          }
          self.teardown(emitEnd: true)
        }
      }
    }

    engine.prepare()
    try engine.start()
  }

  // Stop the mic but keep the task alive so the recognizer can emit its final result.
  private func finishAudio() {
    if let engine = audioEngine, engine.isRunning {
      engine.stop()
      engine.inputNode.removeTap(onBus: 0)
    }
    request?.endAudio()
  }

  private func teardown(emitEnd: Bool) {
    if let engine = audioEngine {
      if engine.isRunning {
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
      }
    }
    request?.endAudio()
    task?.cancel()
    audioEngine = nil
    request = nil
    task = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    if emitEnd && !ended {
      ended = true
      sendEvent("onEnd", [:])
    }
  }
}
