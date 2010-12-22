/*
  The script for a background page that handles request blocking and the
  visualization thereof.

  Copyright 2010 Brian Kennish

  Licensed under the Apache License, Version 2.0 (the "License"); you may not
  use this file except in compliance with the License. You may obtain a copy of
  the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
  License for the specific language governing permissions and limitations under
  the License.

  Brian Kennish <byoogle@gmail.com>
*/

/* Populates an array of a given length with a default value. */
function initializeArray(length, defaultValue) {
  const ARRAY = [];
  for (var i = 0; i < length; i++) ARRAY[i] = defaultValue;
  return ARRAY;
}

/* Destringifies an object. */
function deserialize(object) {
  return typeof object == 'string' ? JSON.parse(object) : object;
}

/* Rewrites a generic search cookie with specific domains and paths. */
function mapCookie(cookie, storeId, url, domain, subdomains, paths) {
  const SUBDOMAIN_COUNT = subdomains.length;
  delete cookie.hostOnly;
  delete cookie.session;
  const DOMAIN = cookie.domain;

  for (var i = 0; i < SUBDOMAIN_COUNT; i++) {
    var subdomain = subdomains[i];
    cookie.url = url.replace('www', subdomain).replace('search', subdomain);
    cookie.domain = subdomain + domain;
    COOKIES.set(cookie);
  }

  const PATH_COUNT = paths.length;
  cookie.domain = DOMAIN;

  for (i = 0; i < PATH_COUNT; i++) {
    var path = paths[i];
    cookie.url = url + path;
    cookie.path = '/' + path;
    COOKIES.set(cookie);
  }

  COOKIES.remove({url: url, name: cookie.name, storeId: storeId});
}

/* Rewrites a batch of search cookies. */
function mapCookies(url, service) {
  COOKIES.getAllCookieStores(function(cookieStores) {
    const STORE_COUNT = cookieStores.length;
    const DOMAIN = '.' + service[1][0];
    const SUBDOMAINS = service[2];
    const PATHS = service[3];

    for (var i = 0; i < STORE_COUNT; i++) {
      var storeId = cookieStores[i].id;

      COOKIES.getAll({url: url, storeId: storeId}, function(cookies) {
        const COOKIE_COUNT = cookies.length;
        for (var j = 0; j < COOKIE_COUNT; j++)
            mapCookie(cookies[j], storeId, url, DOMAIN, SUBDOMAINS, PATHS);
      });
    }
  });
}

/* Tallies and indicates the number of blocked requests. */
function incrementCounter(tabId, serviceIndex) {
  const TAB_BLOCKED_COUNTS =
      BLOCKED_COUNTS[tabId] ||
          (BLOCKED_COUNTS[tabId] = [0, initializeArray(SERVICE_COUNT, 0)]);
  const TAB_BLOCKED_COUNT = ++TAB_BLOCKED_COUNTS[0];
  TAB_BLOCKED_COUNTS[1][serviceIndex]++;
  BROWSER_ACTION.setIcon({tabId: tabId, path: 'blocked.png'});
  if (deserialize(localStorage.blockingIndicated))
      BROWSER_ACTION.setBadgeText({tabId: tabId, text: TAB_BLOCKED_COUNT + ''});
}

/*
  The third parties and search engines, titlecased, and domain, subdomain, and
  path names they phone home with and secure URL of their query page,
  lowercased.
*/
const SERVICES = [
  ['Digg', ['digg.com']],
  ['Facebook', ['facebook.com', 'facebook.net', 'fbcdn.net']],
  ['Google', [
    'google.com',
    '2mdn.net',
    'doubleclick.net',
    'feedburner.com',
    'gmodules.com',
    'google-analytics.com',
    'googleadservices.com',
    'googlesyndication.com'
  ], [
    'adwords',
    'checkout',
    'chrome',
    'code',
    'docs',
    'feedburner',
    'groups',
    'health',
    'knol',
    'mail',
    'picasaweb',
    'sites',
    'sketchup',
    'wave'
  ], [
    'accounts',
    'adsense',
    'analytics',
    'bookmarks',
    'calendar',
    'ig',
    'latitude',
    'reader',
    'voice',
    'webmasters'
    // Chrome won't persist more than 11 paths (probably because of cookie
    // limits) -- "alerts", "cse", "dfp", "friendconnect", "local", "merchants",
    // "notebook", and "support" are omitted for headroom.
  ], 'https://www.google.com/'],
  ['Twitter', ['twitter.com', 'twimg.com']],
  ['Yahoo', ['yahoo.com'], [
    'address',
    'answers',
    'apps',
    'buzz',
    'calendar',
    'edit',
    'games',
    'groups',
    'hotjobs',
    'local',
    'mail',
    'my',
    'notepad',
    'pipes',
    'pulse',
    'shine',
    'sports',
    'upcoming',
    'webmessenger',
    'www'
    // Chrome 8 won't persist more than 22 domains -- "alerts", "autos",
    // "avatars", "help", "login" (which is required to enable OpenID access but
    // conflicts with "edit"), "messages", "realestate", "smallbusiness",
    // "travel", "widgets", and all international subdomains are omitted.
  ], [], 'https://search.yahoo.com/']
];

/* The number of third parties. */
const SERVICE_COUNT = SERVICES.length;

/* The suffix of the blocking key. */
const BLOCKED_NAME = 'Blocked';

/* The number of blocked requests per tab, overall and by third party. */
const BLOCKED_COUNTS = {};

/* The "tabs" API. */
const TABS = chrome.tabs;

/* The "cookies" API. */
const COOKIES = chrome.cookies;

/* The "browserAction" API. */
const BROWSER_ACTION = chrome.browserAction;

/* A throwaway index. */
var i;

if (!deserialize(localStorage.initialized)) {
  for (i = 0; i < SERVICE_COUNT; i++)
      localStorage[SERVICES[i][0].toLowerCase() + BLOCKED_NAME] = true;
  localStorage.blockingIndicated = true;
  localStorage.initialized = true;
}

for (i = 0; i < SERVICE_COUNT; i++) {
  var service = SERVICES[i];
  var url = service[4];
  if (url && deserialize(localStorage[service[0].toLowerCase() + BLOCKED_NAME]))
      mapCookies(url, service);
}

BROWSER_ACTION.setBadgeBackgroundColor({color: [60, 92, 153, 255]});

/* Resets the number of blocked requests for a tab. */
TABS.onUpdated.addListener(function(tabId, changeInfo) {
  if (changeInfo.status == 'loading') delete BLOCKED_COUNTS[tabId];
});

/* Builds a block list or adds to the number of blocked requests. */
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.initialized) {
    const BLACKLIST = [];

    for (var i = 0; i < SERVICE_COUNT; i++) {
      var service = SERVICES[i];
      BLACKLIST[i] =
          deserialize(localStorage[service[0].toLowerCase() + BLOCKED_NAME]) ?
              [service[1], !!service[2]] : [[], false];
    }

    sendResponse({blacklist: BLACKLIST});
  } else {
    incrementCounter(sender.tab.id, request.serviceIndex);
    sendResponse({});
  }
});

/*
  Optionally rewrites a search cookie and adds to the number of blocked
  requests.
*/
COOKIES.onChanged.addListener(function(changeInfo) {
  if (!changeInfo.removed) {
    const COOKIE = changeInfo.cookie;
    const DOMAIN = COOKIE.domain;
    const PATH = COOKIE.path;

    for (var i = 0; i < SERVICE_COUNT; i++) {
      var service = SERVICES[i];
      var url = service[4];
      var domain = '.' + service[1][0];

      if (
        url &&
            deserialize(localStorage[service[0].toLowerCase() + BLOCKED_NAME])
                && DOMAIN == domain && PATH == '/'
      ) {
        mapCookie(COOKIE, COOKIE.storeId, url, domain, service[2], service[3]);

        setTimeout(function(serviceIndex) {
          TABS.getSelected(null, function(tab) {
            incrementCounter(tab.id, serviceIndex);
          }); // The cookie might not be getting set from the selected tab.
        }.bind(null, i), 2000);
            // This function call would otherwise race that of the tab listener.
      }
    }
  }
});
