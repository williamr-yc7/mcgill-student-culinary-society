(function () {
'use strict';

// -------------------------------------------------------------------
// Newest year first. To add a year, drop another object at the top.
// Roles are free text. Set link to 'N/A' (or omit it) for no link;
// anyone with a real link becomes a clickable row.
// --------------------------------------------------------------------
const PAST_TEAMS = [
    {
        year: '2022–23',
        members: [
            { name: 'Chelsea Finstad', role: 'President', link: 'N/A' },
            { name: 'Cella Wardrop', role: 'VP Internal', link: 'https://www.linkedin.com/in/cella-wardrop/' },
            { name: 'Isabella Benedetti', role: 'VP Finance', link: 'https://www.linkedin.com/in/isabella-benedetti1/' },
            { name: 'Kehan Shi', role: 'VP Fundraising', link: 'https://www.linkedin.com/in/kehan-shi/' },
            { name: 'Charlie Quinn', role: 'VP Communications', link: 'https://www.linkedin.com/in/charles-quinn-b7a8041a2/' },
            { name: 'Ananya Krishnakumar', role: 'VP Events', link: 'https://www.linkedin.com/in/ananya-krishnakumar-18894720b/' },
            { name: 'Hugo Tremblay', role: 'Project Manager', link: 'https://www.linkedin.com/in/hugo-tremblay/' },
            { name: 'Ava Sproul', role: 'Project Manager', link: 'https://www.linkedin.com/in/ava-sproul/' }
        ]
    },
    {
        year: '2021–22',
        members: [
            { name: 'Chelsea Finstad', role: 'President', link: 'N/A' },
            { name: 'Cella Wardrop', role: 'VP Communications', link: 'https://www.linkedin.com/in/cella-wardrop/' },
            { name: 'Lola Lühmann', role: 'Project Manager', link: 'https://www.linkedin.com/in/lola-luhmann/' },
            { name: 'Dallas Rager', role: 'First Year Representative', link: 'https://www.linkedin.com/in/dallasrager859/' },
            { name: 'Zoe Martin', role: 'First Year Representative', link: 'N/A' },
            { name: 'Kehan Shi', role: 'First Year Representative', link: 'https://www.linkedin.com/in/kehan-shi/' }
        ]
    },
    {
        year: '2016–17',
        members: [
            { name: 'Zhe Li', role: 'Co-President', link: 'https://www.linkedin.com/in/zhe-li/' },
            { name: 'Elena He', role: 'Co-President', link: 'https://www.linkedin.com/in/elena-qianzi-he-378a6b132/' },
            { name: 'Lauren Chia', role: 'VP Internal', link: 'https://www.linkedin.com/in/lauren-chia-871875153/' },
            { name: 'Floriane Groux', role: 'VP External', link: 'https://www.linkedin.com/in/floriane-groux-80007622a/' },
            { name: 'Marie-Valentine Pinton', role: 'VP External', link: 'https://www.linkedin.com/in/marie-valentine-pinton/' },
            { name: 'Gallien Figuereo', role: 'VP Events', link: 'https://www.linkedin.com/in/gallien-figuereo-99476a118/' },
            { name: 'Haizee Zhu', role: 'VP Events', link: 'https://mila.quebec/en/directory/he-zhu' },
            { name: 'Joni William', role: 'VP Events', link: 'https://www.linkedin.com/in/joni-williams-69175b13a/' },
            { name: 'Bianca Birsan', role: 'VP Media', link: 'https://www.linkedin.com/in/biancabirsan/' },
            { name: 'Evrim Ozer', role: 'VP Media', link: 'https://www.linkedin.com/in/evrimozer/' },
            { name: 'Megane Rosie Quelvennec', role: 'First Year Representative', link: 'N/A' },
            { name: 'Kiren Rao', role: 'VP Technology', link: 'https://www.linkedin.com/in/kiren-rao/' },
            { name: 'Oliver Xie', role: 'VP Finance', link: 'https://www.linkedin.com/in/olivierli/' },
            { name: 'Edward Tu', role: 'First Year Representative', link: 'https://www.linkedin.com/in/edward-tu-869017134/' },
            { name: 'Tamim Sujat', role: 'Photographer', link: 'https://www.linkedin.com/in/tamimsujat/' },
            { name: 'Celine Te', role: 'Mac Campus Committee', link: 'https://www.linkedin.com/in/celine-te/' },
            { name: 'Yiting Huang', role: 'Mac Campus Committee', link: 'https://www.linkedin.com/in/yi-ting-huang/?locale=en' }
        ]
    }
];


const tabsEl = document.getElementById('pastTeamTabs');
const listEl = document.getElementById('pastTeamList');

if (tabsEl && listEl && PAST_TEAMS.length) {
    let active = 0;

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function hasLink(m) {
        return m.link && m.link !== 'N/A';
    }

    function renderTabs() {
        tabsEl.innerHTML = PAST_TEAMS.map((t, i) => `
            <button class="past-tab${i === active ? ' is-active' : ''}" data-i="${i}" type="button">
                ${escapeHtml(t.year)}
            </button>
        `).join('');

        tabsEl.querySelectorAll('.past-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                active = Number(btn.dataset.i);
                renderTabs();
                renderList();
            });
        });
    }

    function renderList() {
        const team = PAST_TEAMS[active];
        listEl.innerHTML = team.members.map(m => {
            const inner = `
                <span class="past-member-name">${escapeHtml(m.name)}</span>
                <span class="past-member-role ui">${escapeHtml(m.role)}</span>
            `;
            const row = hasLink(m)
                ? `<a class="past-member-row" href="${escapeHtml(m.link)}" target="_blank" rel="noopener">${inner}</a>`
                : `<span class="past-member-row is-nolink">${inner}</span>`;
            return `<li class="past-member">${row}</li>`;
        }).join('');
    }

    renderTabs();
    renderList();
}

})();