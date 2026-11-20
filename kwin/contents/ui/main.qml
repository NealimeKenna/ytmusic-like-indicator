import QtQuick
import org.kde.kirigami as Kirigami
import org.kde.plasma.core as PlasmaCore
import org.kde.kwin

Item {
    id: root

    readonly property string clientId: "kwin-like-indicator"
    readonly property string appDesktopFileName: "com.github.th-ch.youtube-music"
    readonly property string apiBaseUrl: `http://${KWin.readConfig("host", "127.0.0.1")}:${KWin.readConfig("port", 26538)}`
    readonly property int pollIntervalMilliseconds: 2000
    readonly property real heartToIconRatio: 0.35
    readonly property var songStates: ["LIKE", "DISLIKE", "INDIFFERENT"]

    property string likeState: "UNREACHABLE"
    property string accessToken: ""
    property bool isAuthorizing: false
    property bool isAccessDenied: false
    property var pendingRefresh: null
    property rect iconGeometry: Qt.rect(0, 0, 0, 0)

    readonly property bool hasSong: songStates.includes(likeState)
    readonly property bool isLiked: likeState === "LIKE"
    readonly property bool isDisliked: likeState === "DISLIKE"
    readonly property bool isFullScreenActive: Workspace.activeWindow?.fullScreen ?? false

    function request(method, path, onDone) {
        const httpRequest = new XMLHttpRequest();
        httpRequest.open(method, apiBaseUrl + path);
        if (accessToken)
            httpRequest.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        httpRequest.onreadystatechange = () => {
            if (httpRequest.readyState === XMLHttpRequest.DONE)
                onDone(httpRequest);
        };
        httpRequest.send();
        return httpRequest;
    }

    function authorize() {
        if (isAuthorizing)
            return;
        isAuthorizing = true;
        request("POST", `/auth/${clientId}`, response => {
            isAuthorizing = false;
            isAccessDenied = response.status === 403;
            if (response.status === 200) {
                accessToken = JSON.parse(response.responseText).accessToken;
                refresh();
            }
        });
    }

    function refresh() {
        const appWindow = Array.from(Workspace.stackingOrder).find(window => window.desktopFileName === appDesktopFileName);
        iconGeometry = appWindow ? appWindow.iconGeometry : Qt.rect(0, 0, 0, 0);

        if (pendingRefresh)
            return;
        pendingRefresh = request("GET", "/api/v1/like-state", response => {
            pendingRefresh = null;
            if (response.status === 401) {
                accessToken = "";
                likeState = "UNAUTHORIZED";
                if (!isAccessDenied)
                    authorize();
            } else if (response.status === 200) {
                likeState = JSON.parse(response.responseText).state ?? "NO_SONG";
            } else {
                likeState = "UNREACHABLE";
            }
        });
    }

    function changeSong(path, osdFor) {
        if (likeState === "UNAUTHORIZED") {
            authorize();
            return;
        }
        if (!hasSong)
            return;
        const wasLiked = isLiked;
        const wasDisliked = isDisliked;
        request("POST", path, response => {
            if (response.status >= 300)
                return;
            const osd = osdFor(wasLiked, wasDisliked);
            showOsd.arguments = [osd.icon, osd.text];
            showOsd.call();
            refresh();
        });
    }

    Timer {
        interval: root.pollIntervalMilliseconds
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: root.refresh()
    }

    ShortcutHandler {
        name: "YouTube Music: Like or remove like"
        text: "YouTube Music: Like or remove like"
        sequence: "Meta+Shift+L"
        onActivated: root.changeSong("/api/v1/like", wasLiked =>
            ({icon: "emblem-favorite", text: wasLiked ? "Like removed" : "Liked"}))
    }

    ShortcutHandler {
        name: "YouTube Music: Dislike or remove dislike"
        text: "YouTube Music: Dislike or remove dislike"
        sequence: "Meta+Shift+D"
        onActivated: root.changeSong("/api/v1/dislike", (wasLiked, wasDisliked) => wasDisliked
            ? {icon: "emblem-favorite", text: "Dislike removed"}
            : {icon: "dialog-cancel", text: "Disliked"})
    }

    DBusCall {
        id: showOsd
        service: "org.kde.plasmashell"
        path: "/org/kde/osdService"
        dbusInterface: "org.kde.osdService"
        method: "showText"
    }

    PlasmaCore.Window {
        id: badge

        readonly property real iconSide: Math.min(root.iconGeometry.width, root.iconGeometry.height)
        readonly property int heartSize: Math.round(iconSide * root.heartToIconRatio)

        flags: Qt.X11BypassWindowManagerHint | Qt.FramelessWindowHint | Qt.WindowTransparentForInput | Qt.WindowDoesNotAcceptFocus
        width: heartSize + leftPadding + rightPadding
        height: heartSize + topPadding + bottomPadding
        x: root.iconGeometry.x + (root.iconGeometry.width + iconSide) / 2 - width
        y: root.iconGeometry.y + (root.iconGeometry.height + iconSide) / 2 - height
        visible: root.hasSong && heartSize > 0 && !root.isFullScreenActive

        mainItem: Kirigami.Icon {
            width: badge.heartSize
            height: badge.heartSize
            source: Qt.resolvedUrl(`../icons/heart-${root.isLiked ? "filled" : root.isDisliked ? "broken" : "outline"}-symbolic.svg`)
            isMask: true
            color: root.isLiked ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
        }
    }
}
