/*
  A content script that stops Facebook from tracking the webpages you go to.

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

/* The domain names Facebook phones home with, lowercased. */
const DOMAINS = ['facebook.com', 'facebook.net', 'fbcdn.net'];

/* The number of domain names. */
const DOMAIN_COUNT = DOMAINS.length;

/* Determines whether a domain is part of a URL, regex free. */
function isMatching(url, domain) {
  return url.toLowerCase().indexOf(domain, 7) >= 7;
      // A valid URL has at least seven characters ("http://"), then the domain.
}

/* Traps and selectively cancels a request. */
if (!isMatching(location.href, DOMAINS[0])) {
  document.addEventListener("beforeload", function(event) {
    var matching;
    for (var i = 0; i < DOMAIN_COUNT; i++)
        if (matching = isMatching(event.url, DOMAINS[i])) break;
    if (matching) event.preventDefault();
  }, true);
}
