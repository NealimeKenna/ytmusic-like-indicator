import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {AuthorizationDeniedError, LikeState, PearApi} from './api.js';
import {DockHearts} from './dock.js';

const POLL_INTERVAL_SECONDS = 2;
const UNAUTHORIZED_OPACITY = 128;
const FULL_OPACITY = 255;
const SONG_STATES = [LikeState.Like, LikeState.Dislike, LikeState.Indifferent];

const PanelHeart = GObject.registerClass(
class PanelHeart extends PanelMenu.Button {
    _init(name, onClick) {
        super._init(0.5, name, true);
        this._icon = new St.Icon({style_class: 'system-status-icon'});
        this.add_child(this._icon);
        this.connect('button-press-event', () => {
            onClick();
            return Clutter.EVENT_STOP;
        });
    }

    render(gicon, isUnauthorized, visible) {
        this.visible = visible;
        this._icon.gicon = gicon;
        this._icon.opacity = isUnauthorized ? UNAUTHORIZED_OPACITY : FULL_OPACITY;
    }
});

export default class LikeIndicatorExtension extends Extension {
    enable() {
        const settings = this.getSettings();
        this._api = new PearApi(settings);
        this._state = LikeState.Unreachable;
        this._icons = {
            filled: this._loadIcon('heart-filled-symbolic'),
            outline: this._loadIcon('heart-outline-symbolic'),
            broken: this._loadIcon('heart-broken-symbolic'),
        };

        this._dockHearts = new DockHearts();
        this._panelHeart = new PanelHeart(this.metadata.name, () => this._toggleLike());
        Main.panel.addToStatusArea(this.uuid, this._panelHeart);

        const actionMode = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        Main.wm.addKeybinding('toggle-like', settings, Meta.KeyBindingFlags.NONE, actionMode,
            () => this._toggleLike({showOsd: true}));
        Main.wm.addKeybinding('toggle-dislike', settings, Meta.KeyBindingFlags.NONE, actionMode,
            () => this._toggleDislike());

        this._render();
        this._refresh();
        this._pollSourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_SECONDS, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        GLib.source_remove(this._pollSourceId);
        Main.wm.removeKeybinding('toggle-like');
        Main.wm.removeKeybinding('toggle-dislike');
        this._api.destroy();
        this._dockHearts.clear();
        this._panelHeart.destroy();
        this._api = null;
        this._dockHearts = null;
        this._panelHeart = null;
        this._icons = null;
    }

    _loadIcon(name) {
        return Gio.FileIcon.new(this.dir.resolve_relative_path(`icons/${name}.svg`));
    }

    async _toggleLike({showOsd = false} = {}) {
        const wasLiked = this._state === LikeState.Like;
        const changed = await this._changeSong(() => this._api.like());
        if (changed && showOsd)
            this._showOsd(wasLiked ? this._icons.outline : this._icons.filled, wasLiked ? 'Like removed' : 'Liked');
    }

    async _toggleDislike() {
        const wasDisliked = this._state === LikeState.Dislike;
        const changed = await this._changeSong(() => this._api.dislike());
        if (changed)
            this._showOsd(wasDisliked ? this._icons.outline : this._icons.broken, wasDisliked ? 'Dislike removed' : 'Disliked');
    }

    async _changeSong(action) {
        try {
            if (this._state === LikeState.Unauthorized) {
                await this._api.authorize();
                await this._refresh();
                return false;
            }
            if (!SONG_STATES.includes(this._state))
                return false;

            await action();
            await this._refresh();
            return true;
        } catch (error) {
            if (error instanceof AuthorizationDeniedError)
                Main.notify(this.metadata.name, 'Access was denied in the YouTube Music app.');
            else
                logError(error, this.metadata.name);
            return false;
        }
    }

    async _refresh() {
        if (this._refreshing)
            return;
        this._refreshing = true;
        try {
            this._state = await this._api.likeState();
            this._render();
        } catch (error) {
            if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(error, this.metadata.name);
        } finally {
            this._refreshing = false;
        }
    }

    _render() {
        const gicon = this._stateIcon();
        const isUnauthorized = this._state === LikeState.Unauthorized;
        const hasSong = SONG_STATES.includes(this._state);
        const shownOnDock = hasSong && this._renderOnDock(gicon);
        if (!hasSong)
            this._dockHearts.clear();
        this._panelHeart.render(gicon, isUnauthorized, isUnauthorized || (hasSong && !shownOnDock));
    }

    _renderOnDock(gicon) {
        if (this._dockFailed)
            return false;
        try {
            return this._dockHearts.render(gicon, this._state === LikeState.Like);
        } catch (error) {
            logError(error, `${this.metadata.name}: could not show the heart on the dock`);
            this._dockHearts.clear();
            this._dockFailed = true;
            return false;
        }
    }

    _stateIcon() {
        if (this._state === LikeState.Like)
            return this._icons.filled;
        if (this._state === LikeState.Dislike)
            return this._icons.broken;
        return this._icons.outline;
    }

    _showOsd(gicon, label) {
        Main.osdWindowManager.showAll(gicon, label, null, null);
    }
}
