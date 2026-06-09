Pod::Spec.new do |s|
  s.name           = 'AddressAutocomplete'
  s.version        = '1.0.0'
  s.summary        = 'Apple Maps address autocomplete (MKLocalSearchCompleter)'
  s.description    = 'Local Expo module exposing search-as-you-type address suggestions from Apple Maps.'
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
