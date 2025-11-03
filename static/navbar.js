// It returns, this must be the 5th project that navbar.js is the main file, gotta keep it going now.

document.addEventListener('DOMContentLoaded', async () => {
    await loadRequiredLibraries()
    await loadNavbarAndFooter()
    await retrieveNeededTexts()
})


async function retrieveNeededTexts() {
    const elements = document.querySelectorAll('[needed-text]');
    const cache = {};

    for (const ele of elements) {
        const internalName = ele.getAttribute('needed-text');
        const dataKey = ele.dataset.type || 'text_body';

        if (!cache[internalName]) {
            let cached = localStorage.getItem(`mission_${internalName}`);
            let missionData = null;

            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed._cachedAt < 14 * 24 * 60 * 60 * 1000) {
                        missionData = parsed;
                    }
                } catch (err) {
                    console.warn(`Corrupt cache for ${internalName}, ignoring`);
                    localStorage.removeItem(`mission_${internalName}`);
                }
            }

            if (!missionData) {
                try {
                    const response = await fetch(`/api/mission/${internalName}`);
                    if (response.ok) {
                        missionData = await response.json();
                        missionData._cachedAt = Date.now();
                        localStorage.setItem(
                            `mission_${internalName}`,
                            JSON.stringify(missionData)
                        );
                    } else {
                        console.warn(`Failed to fetch ${internalName}`);
                        ele.innerHTML = 'Failed to load content.';
                        continue;
                    }
                } catch (error) {
                    console.error(`Fetch error for ${internalName}:`, error);
                    ele.innerHTML = 'Failed to load content.';
                    continue;
                }
            }

            cache[internalName] = missionData;
        }

        const missionData = cache[internalName];
        if (!missionData) continue;

        const value = missionData[dataKey];

        if (value === undefined) continue;

        if (dataKey === 'text_body') {
            ele.innerHTML = showdownConverter.makeHtml(value);
        } else {
            ele.textContent = value;
        }
    }
}

async function loadRequiredLibraries() {
    const libraryMappings = {
        'showdown': ['https://cdnjs.cloudflare.com/ajax/libs/showdown/2.1.0/showdown.min.js', () => {
            window.showdownConverter = new showdown.Converter({
                tables: true,
                simplifiedAutoLink: true,
                strikethrough: true,
                tasklists: true,
                simpleLineBreaks: true
            });
            showdownConverter.addExtension([
                {
                    type: 'lang',
                    regex: /\[<(\w+)>](.*?)\[<\1>]/gs,
                    replace: (match, color, content) => {
                        return `<span style="color:${color}">${content}</span>`;
                    },
                }
            ], 'colorExtension');
        }],
    }
    const libraryMeta = document.querySelector('meta[name="libraries"]')
    if (libraryMeta) {
        const librariesToLoad = libraryMeta.getAttribute('content').split(',').map(lib => lib.trim())
        await Promise.all(
            librariesToLoad.map(lib => {
                const url = libraryMappings[lib][0];
                const callback = libraryMappings[lib][1];
                if (!url) {
                    console.warn(`No CDN URL defined for: ${lib}`);
                    return Promise.resolve();
                }
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.async = true;
                    script.onload = () => {
                        callback();
                        resolve(url);
                    };
                    script.onerror = () => reject(new Error(`Failed to load ${url}`));
                    document.head.appendChild(script);
                });
            })
        ).then(() => { }).catch(err => console.error(err));
    }
}

async function loadNavbarAndFooter() {
    const [navbar, footer] = await Promise.all([
        fetch('/static/navbar.html').then(res => res.text()),
        fetch('/static/footer.html').then(res => res.text())
    ]);
    document.querySelector('nav').innerHTML = navbar;
    document.querySelector('footer').innerHTML = footer;
}