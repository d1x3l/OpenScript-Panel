[Setup]
AppName=OpenScript Panel
AppVersion=0.1.0-beta
AppPublisher=IlTuoNome
DefaultDirName={userappdata}\Adobe\CEP\extensions\com.custom.openscriptpanel
DisableDirPage=yes
OutputBaseFilename=OpenScriptPanel_Setup_v0.1.0_Beta
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=lowest
UninstallDisplayName=OpenScript Panel (Rimuovi)

[Files]
; Usa il parametro corretto Excludes per ignorare i file non necessari
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.iss,*.git*,*.exe,Output\*"

[Registry]
; Abilita la modalita debug CEP su tutte le versioni Adobe
Root: HKCU; Subkey: "Software\Adobe\CSXS.9"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.10"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"

[Messages]
SetupAppTitle=Installazione OpenScript Panel
SetupWindowTitle=Installazione OpenScript Panel - Beta