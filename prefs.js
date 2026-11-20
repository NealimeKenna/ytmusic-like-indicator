import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LikeIndicatorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        page.add(this._shortcutGroup(window, settings));
        page.add(this._connectionGroup(settings));
        window.add(page);
    }

    _shortcutGroup(window, settings) {
        const group = new Adw.PreferencesGroup({title: 'Shortcuts'});
        group.add(this._shortcutRow(window, settings, 'toggle-like', 'Like or unlike the current song'));
        group.add(this._shortcutRow(window, settings, 'toggle-dislike', 'Dislike the current song or remove the dislike'));
        return group;
    }

    _shortcutRow(window, settings, key, title) {
        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: 'Disabled',
            valign: Gtk.Align.CENTER,
        });
        const showShortcut = () => {
            shortcutLabel.accelerator = settings.get_strv(key)[0] ?? '';
        };
        showShortcut();
        settings.connect(`changed::${key}`, showShortcut);

        const row = new Adw.ActionRow({title, activatable: true});
        row.add_suffix(shortcutLabel);
        row.connect('activated', () => this._captureShortcut(window, settings, key));
        return row;
    }

    _captureShortcut(window, settings, key) {
        const dialog = new Adw.AlertDialog({
            heading: 'Set shortcut',
            body: 'Press the new shortcut. Backspace disables it, Escape cancels.',
        });
        dialog.add_response('cancel', 'Cancel');

        const keyController = new Gtk.EventControllerKey();
        keyController.connect('key-pressed', (_controller, keyval, keycode, modifierState) => {
            const modifiers = modifierState & Gtk.accelerator_get_default_mod_mask();
            if (modifiers === 0 && keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (modifiers === 0 && keyval === Gdk.KEY_BackSpace) {
                settings.set_strv(key, []);
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (!Gtk.accelerator_valid(keyval, modifiers))
                return Gdk.EVENT_STOP;

            settings.set_strv(key, [Gtk.accelerator_name_with_keycode(null, keyval, keycode, modifiers)]);
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(keyController);
        dialog.present(window);
    }

    _connectionGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Connection',
            description: 'Where the API Server plugin of the YouTube Music app listens.',
        });

        const hostRow = new Adw.EntryRow({title: 'Host'});
        settings.bind('host', hostRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(hostRow);

        const portRow = Adw.SpinRow.new_with_range(1, 65535, 1);
        portRow.title = 'Port';
        settings.bind('port', portRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(portRow);

        const forgetRow = new Adw.ButtonRow({title: 'Forget access token'});
        forgetRow.connect('activated', () => settings.set_string('access-token', ''));
        group.add(forgetRow);

        return group;
    }
}
