gyotaku for Windows (preview)
=============================

Search every screenshot you have taken by the text inside it.

Getting started
---------------

1. Keep the three files together in one folder you won't delete, for
   example C:\Users\you\AppData\Local\gyotaku:
     gyotaku-app.exe   the search window
     gyotaku.exe       the background reader and command line
     onnxruntime.dll   Microsoft's ONNX Runtime, used to read text
2. Run gyotaku-app.exe. The first time, it asks which folders to read
   (Pictures\Screenshots is where Windows saves Win+PrtScn and the
   Snipping Tool's screenshots) and whether to keep reading new ones in
   the background. Saying yes also starts gyotaku when you sign in.
3. Press Alt+Shift+S anywhere to open or close the search window.

The first run downloads the OCR models once (about 22 MB). After that
everything happens on this computer, nothing is uploaded.

Windows may warn that the app is from an unknown publisher, since it isn't
signed yet. Choose "More info" and then "Run anyway".

To remove it: turn off background reading in settings (Ctrl+,), quit
(Ctrl+Q), and delete the folder. The index lives in
%LOCALAPPDATA%\gyotaku and %APPDATA%\gyotaku.

Problems and ideas: https://github.com/xevrion/gyotaku/issues
