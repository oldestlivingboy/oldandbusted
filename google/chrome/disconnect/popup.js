/*
  The script for a popup that displays and drives the blocking of requests.

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

/* Erases a batch of cookies. */
function reduceCookies(url, storeId) {
  COOKIES.getAll({url: url, storeId: storeId}, function(cookies) {
    const COOKIE_COUNT = cookies.length;
    for (var i = 0; i < COOKIE_COUNT; i++)
        COOKIES.remove({url: url, name: cookies[i].name, storeId: storeId});
  });
}

/* Outputs third-party details as per the blocking state. */
function renderService(
  name, lowercaseName, blocked, blockedCount, control, badge, text
) {
  if (blocked) {
    if (blockedCount) {
      badge.src = lowercaseName + '-blocked.png';
      text.removeAttribute('class');
    } else {
      badge.src = lowercaseName + '-activated.png';
      text.className = 'activated';
    }

    control.title = 'Unblock ' + name;
  } else {
    badge.src = lowercaseName + '-deactivated.png';
    text.className = 'deactivated';
    control.title = 'Block ' + name;
  }
}

/* The background window. */
const BACKGROUND = chrome.extension.getBackgroundPage();

/* The deserialization function. */
const DESERIALIZE = BACKGROUND.deserialize;

/* The third parties. */
const SERVICES = BACKGROUND.SERVICES;

/* The number of third parties. */
const SERVICE_COUNT = BACKGROUND.SERVICE_COUNT;

/* The suffix of the blocking key. */
const BLOCKED_NAME = BACKGROUND.BLOCKED_NAME;

/* The "cookies" API. */
const COOKIES = BACKGROUND.COOKIES;

/* Paints the UI. */
onload = function() {
  chrome.tabs.getSelected(null, function(tab) {
    const TAB_BLOCKED_COUNTS = BACKGROUND.BLOCKED_COUNTS[tab.id];
    const SERVICE_BLOCKED_COUNTS =
        TAB_BLOCKED_COUNTS ? TAB_BLOCKED_COUNTS[1] :
            BACKGROUND.initializeArray(SERVICE_COUNT, 0);
    const SURFACE = document.getElementsByTagName('tbody')[0];

    for (var i = 0; i < SERVICE_COUNT; i++) {
      var service = SERVICES[i];
      var name = service[0];
      var lowercaseName = name.toLowerCase();
      var blockedName = lowercaseName + BLOCKED_NAME;
      var blockedCount = SERVICE_BLOCKED_COUNTS[i];
      var control =
          SURFACE.appendChild(
            document.getElementsByTagName('tr')[0].cloneNode(true)
          );
      var badge = control.getElementsByTagName('img')[0];
      var text = control.getElementsByTagName('td')[1];
      renderService(
        name,
        lowercaseName,
        DESERIALIZE(localStorage[blockedName]),
        blockedCount,
        control,
        badge,
        text
      );
      badge.alt = name;
      text.textContent = blockedCount + text.textContent;

      control.onmouseover = function() { this.className = 'mouseover'; };

      control.onmouseout = function() { this.removeAttribute('class'); };

      control.onclick = function(
        service,
        name,
        lowercaseName,
        blockedName,
        blockedCount,
        control,
        badge,
        text
      ) {
        const URL = service[4];
        const BLOCKED =
            localStorage[blockedName] = !DESERIALIZE(localStorage[blockedName]);

        if (URL) {
          if (BLOCKED) {
            BACKGROUND.mapCookies(URL, service);
          } else {
            COOKIES.getAllCookieStores(function(cookieStores) {
              const STORE_COUNT = cookieStores.length;
              const SUBDOMAINS = service[2];
              const SUBDOMAIN_COUNT = SUBDOMAINS.length;
              const DOMAIN = '.' + service[1][0];
              const PATHS = service[3];
              const PATH_COUNT = PATHS.length;

              for (var i = 0; i < STORE_COUNT; i++) {
                var storeId = cookieStores[i].id;

                for (var j = 0; j < SUBDOMAIN_COUNT; j++) {
                  var subdomain = SUBDOMAINS[j];
                  var url =
                      URL.
                        replace('www', subdomain).
                        replace('search', subdomain);

                  if (!j) {
                    COOKIES.getAll(
                      {url: url, storeId: storeId}, function(cookies) {
                        const COOKIE_COUNT = cookies.length;

                        for (var i = 0; i < COOKIE_COUNT; i++) {
                          var details = cookies[i];
                          details.url = URL;
                          details.domain = DOMAIN;
                          delete details.hostOnly;
                          delete details.session;

                          BACKGROUND.setTimeout(function(details) {
                            COOKIES.set(details);
                          }.bind(null, details), 1000);
                        }
                      }
                    );
                  }

                  reduceCookies(url, storeId);
                }

                for (j = 0; j < PATH_COUNT; j++)
                    reduceCookies(URL + PATHS[j], storeId);
              }
            });
          }
        }

        renderService(
          name, lowercaseName, BLOCKED, blockedCount, control, badge, text
        );
      }.bind(
        null,
        service,
        name,
        lowercaseName,
        blockedName,
        blockedCount,
        control,
        badge,
        text
      );
    }
  });
};
