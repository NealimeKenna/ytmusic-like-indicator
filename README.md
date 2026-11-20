# YouTube Music Like Indicator

A GNOME Shell extension that shows on the dock icon of the
[YouTube Music desktop app](https://github.com/pear-devs/pear-desktop) (th-ch/youtube-music, now Pear Desktop)
whether the song that's playing is liked.

- Red heart: the song is liked. Outline: it isn't. Broken heart: it is disliked.
- <kbd>Shift</kbd>+<kbd>Super</kbd>+<kbd>L</kbd> likes the song or removes the like.
- <kbd>Shift</kbd>+<kbd>Super</kbd>+<kbd>D</kbd> dislikes the song (the app then skips it) or removes the dislike.
- The heart is hidden when the app isn't running or nothing is playing.

The heart sits on the app's icon in Ubuntu Dock or Dash to Dock. Without one of those docks it shows in the top bar
instead, where clicking it likes the song. The dock heart relies on how those docks build their icons, so a dock
update can break it; the extension then falls back to the top bar.

It talks to the app's built-in **API Server** plugin over `localhost`, so it needs no Google account or API key.

Supports GNOME Shell 48, 49 and 50.

## Setup

1. In the YouTube Music app, open **Plugins → API Server** and enable it. Keep the authorization strategy on
   **Auth at first** and set the hostname to `127.0.0.1`, so the API is not reachable from your network.
2. Install the extension:

   ```sh
   git clone https://github.com/NealimeKenna/ytmusic-like-indicator.git
   cd ytmusic-like-indicator
   make install
   ```

3. Log out and back in (on Wayland GNOME Shell only picks up new extensions at login), then enable it:

   ```sh
   gnome-extensions enable ytmusic-like-indicator@nealimekenna.github.com
   ```

4. A dimmed heart appears in the top bar while the extension is not yet allowed to use the API. Click it (or press
   one of the shortcuts) and choose **Allow** in the dialog the app shows.

## Settings

Open them with `gnome-extensions prefs ytmusic-like-indicator@nealimekenna.github.com`:

- the like and dislike shortcuts,
- the host and port of the API Server plugin (default `127.0.0.1:26538`),
- forgetting the access token, so the next click asks the app for access again.

## License

GPL-2.0-or-later
