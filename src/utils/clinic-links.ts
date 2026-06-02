const relatedHostPattern = /(?:youtube\.com|youtu\.be|goo\.gl|google\.[^/]+|doctorqube|sysmex|fc2\.com|goo\.ne\.jp|g-pit\.com)/i;
const relatedPathPattern = /(?:^|\/)(?:gid|gd|gender|mtf|ftm|trans|srs|hrt|lgbt)(?:[\/-]|$)|[#?]/i;
const homepagePathPattern = /^(?:\/|\/index(?:\.[a-z0-9]+)?|\/[a-z0-9_-]+\/?)$/i;

export interface ClinicLinks {
  officialUrls: string[];
  relatedUrls: string[];
}

function isRelatedUrl(url: URL) {
  return relatedHostPattern.test(url.hostname) || relatedPathPattern.test(`${url.pathname}${url.hash}${url.search}`);
}

function isOfficialHomepage(url: URL) {
  return homepagePathPattern.test(url.pathname) && !url.search && !url.hash;
}

export function splitClinicUrls(urls: string[]): ClinicLinks {
  const officialUrls: string[] = [];
  const relatedUrls: string[] = [];

  for (const value of urls) {
    try {
      const url = new URL(value);

      if (isRelatedUrl(url)) {
        relatedUrls.push(value);
        continue;
      }

      if (isOfficialHomepage(url) || officialUrls.length === 0) {
        officialUrls.push(value);
        continue;
      }

      relatedUrls.push(value);
    } catch {
      relatedUrls.push(value);
    }
  }

  return { officialUrls, relatedUrls };
}
