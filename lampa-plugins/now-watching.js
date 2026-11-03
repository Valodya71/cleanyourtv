/*
 * CleanYourTV: publish Lampa's TMDB home shelves as Android TV preview channels.
 * Install in Lampa's Extensions by URL. Requires Lampa Android 1.13.4+ and its plugin-channel bridge.
 * It uses Lampa's existing TMDB source and settings; it does not make direct network requests.
 */
(function () {
    'use strict';

    var CHANNEL_PREFIX = 'cleanyourtv.lampa.';
    var installedFlag = '__cleanyourtv_lampa_home_shelves_v3__';

    if (window[installedFlag]) return;
    window[installedFlag] = true;

    function channelId(row, index) {
        var identity = String(row.url || row.title || 'row-' + index).toLowerCase();
        var safe = identity.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
        var hash = 2166136261;
        for (var i = 0; i < identity.length; i++) {
            hash ^= identity.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return CHANNEL_PREFIX + (safe || 'row') + '.' + (hash >>> 0).toString(36);
    }

    function publish(response) {
        if (typeof AndroidJS === 'undefined'
                || typeof AndroidJS.publishPluginChannel !== 'function') return;

        // Lampa.Api.main can report each completed home shelf as an object, or
        // aggregate shelves into an array on compatible builds. Publish every
        // populated shelf so the launcher can offer each one in its chooser.
        var shelves = Array.isArray(response) ? response : [response];
        for (var i = 0; i < shelves.length; i++) publishShelf(shelves[i], i);
    }

    function publishShelf(shelf, index) {
        if (!shelf || !Array.isArray(shelf.results)) return;

        var items = [];
        for (var j = 0; j < shelf.results.length && items.length < 12; j++) {
            var card = shelf.results[j];
            if (!card || card.id === undefined || card.id === null) continue;

            var name = String(card.title || card.name || '').trim();
            if (!name) continue;

            var type = card.media_type === 'tv' || card.type === 'tv' || card.first_air_date ? 'tv' : 'movie';
            var source = String(card.source || 'tmdb');
            if (!/^[A-Za-z0-9._-]{1,64}$/.test(source)) source = 'tmdb';
            var item = {
                id: String(card.id),
                source: source,
                type: type,
                title: name
            };
            if (card.poster_path) item.poster_path = card.poster_path;
            if (card.backdrop_path) item.backdrop_path = card.backdrop_path;
            if (card.overview) item.overview = card.overview;
            if (card.release_date) item.release_date = card.release_date;
            if (card.first_air_date) item.first_air_date = card.first_air_date;
            if (typeof card.vote_average === 'number') item.vote_average = card.vote_average;
            items.push(item);
        }

        // Preserve the last good shelf on an empty result or a server/API error.
        if (!items.length) return;

        var title = String(shelf.title || shelf.url || 'Подборка Lampa').trim();
        AndroidJS.publishPluginChannel(JSON.stringify({
            id: channelId(shelf, index),
            title: title,
            items: items
        }));
    }

    function loadShelf() {
        var tmdb = window.Lampa && Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
        if (!tmdb || typeof tmdb.main !== 'function') return;
        try {
            // TMDB's main source returns a batch of home shelves in its callback.
            tmdb.main({}, publish, function () {});
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
