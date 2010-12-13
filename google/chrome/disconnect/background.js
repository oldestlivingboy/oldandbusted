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

/*
  The third parties, titlecased, and domain names they phone home with,
  lowercased.
*/
const SERVICES = [
  ['Digg', ['digg.com']],
  ['Facebook', ['facebook.com', 'facebook.net', 'fbcdn.net']],
  ['Google', [
    '2mdn.net',
    'doubleclick.net',
    'feedburner.com',
    'google.com',
    'google-analytics.com',
    'googlesyndication.com'
  ]],
  ['Twitter', ['twitter.com']]
];

/* The number of third parties. */
const SERVICE_COUNT = SERVICES.length;

/* The suffix of the blocking key. */
const BLOCKED_NAME = 'Blocked';

/* The number of blocked requests per tab, overall and by third party. */
const BLOCKED_COUNTS = {};

/* The "browserAction" API. */
const BROWSER_ACTION = chrome.browserAction;

if (!deserialize(localStorage.initialized)) {
  for (var i = 0; i < SERVICE_COUNT; i++)
      localStorage[SERVICES[i][0].toLowerCase() + BLOCKED_NAME] = true;
  localStorage.blockingIndicated = true;
  localStorage.initialized = true;
}

BROWSER_ACTION.setBadgeBackgroundColor({color: [60, 92, 153, 255]});

/* Resets the number of blocked requests for a tab. */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
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
              service[1] : [];
    }

    sendResponse({blacklist: BLACKLIST});
  } else {
    const TAB_ID = sender.tab.id;
    const TAB_BLOCKED_COUNTS =
        BLOCKED_COUNTS[TAB_ID] ||
            (BLOCKED_COUNTS[TAB_ID] = [0, initializeArray(SERVICE_COUNT, 0)]);
    const TAB_BLOCKED_COUNT = ++TAB_BLOCKED_COUNTS[0];
    TAB_BLOCKED_COUNTS[1][request.serviceIndex]++;
    BROWSER_ACTION.setIcon({tabId: TAB_ID, path: 'blocked.png'});
    if (deserialize(localStorage.blockingIndicated))
        BROWSER_ACTION.setBadgeText({
          tabId: TAB_ID, text: TAB_BLOCKED_COUNT + ''
        });
    sendResponse({});
  }
});
