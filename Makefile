UUID = ytmusic-like-indicator@nealimekenna.github.com

.PHONY: pack install clean

pack:
	gnome-extensions pack --force --extra-source=api.js --extra-source=dock.js --extra-source=icons --extra-source=LICENSE .

install: pack
	gnome-extensions install --force $(UUID).shell-extension.zip

clean:
	rm -f $(UUID).shell-extension.zip
