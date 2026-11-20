import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const CLIENT_ID = 'gnome-shell-like-indicator';
const REQUEST_TIMEOUT_SECONDS = 5;
const AUTHORIZATION_TIMEOUT_SECONDS = 120;

export const LikeState = {
    Unreachable: 'UNREACHABLE',
    Unauthorized: 'UNAUTHORIZED',
    NoSong: 'NO_SONG',
    Like: 'LIKE',
    Dislike: 'DISLIKE',
    Indifferent: 'INDIFFERENT',
};

export class AuthorizationDeniedError extends Error {}

export class PearApi {
    constructor(settings) {
        this._settings = settings;
        this._session = new Soup.Session({timeout: REQUEST_TIMEOUT_SECONDS});
        this._authorizationSession = new Soup.Session({timeout: AUTHORIZATION_TIMEOUT_SECONDS});
        this._cancellable = new Gio.Cancellable();
    }

    destroy() {
        this._cancellable.cancel();
        this._session.abort();
        this._authorizationSession.abort();
    }

    async likeState() {
        let response;
        try {
            response = await this._request('GET', '/api/v1/like-state');
        } catch (error) {
            if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                throw error;
            return LikeState.Unreachable;
        }

        if (response.status === Soup.Status.UNAUTHORIZED) {
            this._settings.set_string('access-token', '');
            return LikeState.Unauthorized;
        }
        if (response.status !== Soup.Status.OK)
            return LikeState.Unreachable;

        return JSON.parse(response.body).state ?? LikeState.NoSong;
    }

    async like() {
        await this._request('POST', '/api/v1/like');
    }

    async dislike() {
        await this._request('POST', '/api/v1/dislike');
    }

    async authorize() {
        const response = await this._request('POST', `/auth/${CLIENT_ID}`, this._authorizationSession);
        if (response.status === Soup.Status.FORBIDDEN)
            throw new AuthorizationDeniedError();
        if (response.status !== Soup.Status.OK)
            throw new Error(`Authorization failed with HTTP ${response.status}`);

        this._settings.set_string('access-token', JSON.parse(response.body).accessToken);
    }

    async _request(method, path, session = this._session) {
        const host = this._settings.get_string('host');
        const port = this._settings.get_int('port');
        const message = Soup.Message.new(method, `http://${host}:${port}${path}`);
        const token = this._settings.get_string('access-token');
        if (token)
            message.request_headers.append('Authorization', `Bearer ${token}`);

        const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, this._cancellable);
        return {
            status: message.get_status(),
            body: new TextDecoder().decode(bytes.toArray()),
        };
    }
}
