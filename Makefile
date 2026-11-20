UUID = ytmusic-like-indicator@nealimekenna.github.com

.PHONY: pack install clean kwin-install kwin-uninstall

pack:
	gnome-extensions pack --force --extra-source=api.js --extra-source=dock.js --extra-source=icons --extra-source=LICENSE .

install: pack
	gnome-extensions install --force $(UUID).shell-extension.zip

clean:
	rm -f $(UUID).shell-extension.zip

kwin-install:
	kpackagetool6 -t KWin/Script -i kwin || kpackagetool6 -t KWin/Script -u kwin
	kwriteconfig6 --file kwinrc --group Plugins --key ytmusic-like-indicatorEnabled true

kwin-uninstall:
	kwriteconfig6 --file kwinrc --group Plugins --key ytmusic-like-indicatorEnabled false
	kpackagetool6 -t KWin/Script -r ytmusic-like-indicator
