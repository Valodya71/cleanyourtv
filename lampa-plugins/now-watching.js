/*
 * CleanYourTV: publish Lampa's own TMDB "Сейчас смотрят" shelf as an Android TV preview channel.
 * Install in Lampa's Extensions by URL. Requires Lampa Android 1.13.4+ and its plugin-channel bridge.
 * It uses Lampa's existing TMDB source and settings; it does not make direct network requests.
 */
(function () {
    'use strict';

    var CHANNEL_ID = 'cleanyourtv.now-playing';
    var CHANNEL_TITLE = 'Сейчас смотрят';
    var installedFlag = '__cleanyourtv_now_playing_channel__';

    if (window[installedFlag]) return;
    window[installedFlag] = true;

    function isNowPlaying(row) {
        var title = String(row && row.title || '').toLowerCase();
        var url = String(row && row.url || '').toLowerCase();
        return title.indexOf('сейчас смотрят') >= 0
            || title.indexOf('now playing') >= 0
            || title.indexOf('now watching') >= 0
            || url.indexOf('movie/now_playing') >= 0;
    }

    function publish(response) {
        if (typeof AndroidJS === 'undefined'
                || typeof AndroidJS.publishPluginChannel !== 'function') return;

        // TMDB's Api.main feeds its callback one completed shelf at a time.
        // Accept arrays too, for compatible Lampa builds that aggregate them.
        var shelf = null;
        if (Array.isArray(response)) {
            for (var i = 0; i < response.length; i++) {
                if (isNowPlaying(response[i])) {
                    shelf = response[i];
                    break;
                }
            }
        } else if (isNowPlaying(response)) {
            shelf = response;
        }
        if (!shelf || !Array.isArray(shelf.results)) return;

        var items = [];
        for (var j = 0; j < shelf.results.length && items.length < 12; j++) {
            var card = shelf.results[j];
            if (!card || card.id === undefined || card.id === null) continue;

            var name = String(card.title || card.name || '').trim();
            if (!name) continue;

            var item = {
                id: String(card.id),
                source: 'tmdb',
                type: 'movie',
                title: name
            };
            if (card.poster_path) item.poster_path = card.poster_path;
            if (card.backdrop_path) item.backdrop_path = card.backdrop_path;
            if (card.overview) item.overview = card.overview;
            if (card.release_date) item.release_date = card.release_date;
            if (typeof card.vote_average === 'number') item.vote_average = card.vote_average;
            items.push(item);
        }

        // Preserve the last good shelf on an empty result or a server/API error.
        if (!items.length) return;

        AndroidJS.publishPluginChannel(JSON.stringify({
            id: CHANNEL_ID,
            title: CHANNEL_TITLE,
            items: items
        }));
    }

    function loadShelf() {
        if (!window.Lampa || !Lampa.Api || typeof Lampa.Api.main !== 'function') return;
        try {
            // Lampa's first TMDB home row is its own localized "Сейчас смотрят" feed.
            Lampa.Api.main({ source: 'tmdb' }, publish, function () {});
        } catch (ignored) {
            // A transient source error must not clear the last channel written to Android TV.
        }
    }

    if (window.appready) {
        window.setTimeout(loadShelf, 1200);
    } else if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (event) {
            if (event && event.type === 'ready') window.setTimeout(loadShelf, 1200);
        });
    }
})();
