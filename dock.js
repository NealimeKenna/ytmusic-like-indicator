import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const APP_ID = 'com.github.th-ch.youtube-music.desktop';
const DOCK_CONTAINER_NAME = 'dashtodockContainer';
const HEART_TO_APP_ICON_RATIO = 0.4;
const DEFAULT_APP_ICON_SIZE = 48;

function findDescendants(actor, matches) {
    return actor.get_children().flatMap(child =>
        matches(child) ? [child] : findDescendants(child, matches));
}

function isAppIcon(actor) {
    return actor.app?.get_id?.() === APP_ID && actor._iconContainer instanceof Clutter.Actor;
}

function findAppIcons() {
    return findDescendants(Main.layoutManager.uiGroup, actor => actor.name === DOCK_CONTAINER_NAME)
        .flatMap(dockContainer => findDescendants(dockContainer, isAppIcon));
}

export class DockHearts {
    constructor() {
        this._heartsByAppIcon = new Map();
    }

    render(gicon, isLiked) {
        const appIcons = findAppIcons();
        this._removeHeartsExcept(appIcons);
        appIcons.forEach(appIcon => {
            const heart = this._heartsByAppIcon.get(appIcon) ?? this._addHeart(appIcon);
            heart.child.gicon = gicon;
            heart.child.icon_size = Math.round((appIcon.icon?.iconSize ?? DEFAULT_APP_ICON_SIZE) * HEART_TO_APP_ICON_RATIO);
            if (isLiked)
                heart.child.add_style_class_name('liked');
            else
                heart.child.remove_style_class_name('liked');
        });
        return appIcons.length > 0;
    }

    clear() {
        this._removeHeartsExcept([]);
    }

    _addHeart(appIcon) {
        const heart = new St.Bin({
            child: new St.Icon({style_class: 'ytmusic-like-dock-heart'}),
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true,
        });
        heart.connect('destroy', () => this._heartsByAppIcon.delete(appIcon));
        appIcon._iconContainer.add_child(heart);
        this._heartsByAppIcon.set(appIcon, heart);
        return heart;
    }

    _removeHeartsExcept(appIcons) {
        [...this._heartsByAppIcon]
            .filter(([appIcon]) => !appIcons.includes(appIcon))
            .forEach(([, heart]) => heart.destroy());
    }
}
