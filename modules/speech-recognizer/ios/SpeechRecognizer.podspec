Pod::Spec.new do |s|
  s.name           = 'SpeechRecognizer'
  s.version        = '1.0.0'
  s.summary        = 'On-device speech-to-text (SFSpeechRecognizer)'
  s.description    = 'Local Expo module streaming on-device speech recognition for rapid item capture.'
  s.author         = 'Organizard'
  s.homepage       = 'https://organizard.app'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
