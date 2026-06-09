import ExpoModulesCore
import MapKit

// Exposes Apple Maps (MKLocalSearchCompleter) search-as-you-type address
// suggestions to JS. `search(query)` resolves with the current best address
// completions for the fragment. No API key, no location permission required —
// MKLocalSearchCompleter is part of MapKit and free for in-app use.
public class AddressAutocompleteModule: Module {
  // Retain in-flight sessions until they resolve; MKLocalSearchCompleter is
  // delegate-based and would otherwise be deallocated before its callback.
  private var sessions = [ObjectIdentifier: CompleterSession]()

  public func definition() -> ModuleDefinition {
    Name("AddressAutocomplete")

    AsyncFunction("search") { (query: String, promise: Promise) in
      DispatchQueue.main.async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
          promise.resolve([[String: String]]())
          return
        }

        let session = CompleterSession(query: trimmed)
        let id = ObjectIdentifier(session)
        session.onComplete = { [weak self] results in
          promise.resolve(results)
          self?.sessions[id] = nil
        }
        self.sessions[id] = session
        session.start()
      }
    }
  }
}

// One search attempt: owns a completer + delegate, resolves once with the first
// results update (or an empty list on error / timeout), then releases.
final class CompleterSession: NSObject, MKLocalSearchCompleterDelegate {
  private let completer = MKLocalSearchCompleter()
  private let query: String
  private var finished = false
  var onComplete: (([[String: String]]) -> Void)?

  init(query: String) {
    self.query = query
    super.init()
    completer.delegate = self
    if #available(iOS 13.0, *) {
      completer.resultTypes = .address
    }
  }

  func start() {
    completer.queryFragment = query
    // Backstop: if the delegate never fires, resolve empty so the JS promise
    // never hangs.
    DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) { [weak self] in
      self?.finish(with: [])
    }
  }

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    let results = completer.results.prefix(6).map { completion in
      ["title": completion.title, "subtitle": completion.subtitle]
    }
    finish(with: Array(results))
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    finish(with: [])
  }

  private func finish(with results: [[String: String]]) {
    guard !finished else { return }
    finished = true
    completer.delegate = nil
    onComplete?(results)
    onComplete = nil
  }
}
