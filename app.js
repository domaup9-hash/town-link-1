document.addEventListener("DOMContentLoaded", () => {
    const accordionRoot = document.getElementById("accordion-root");
    const expandAllBtn = document.getElementById("expand-all");
    const collapseAllBtn = document.getElementById("collapse-all");

    // Fetch Rules Data from API Endpoint
    async function loadRules() {
        try {
            const response = await fetch("https://kayancfw.com/api/v1/rules");
            const data = await response.json();
            renderAccordion(data.categories);
        } catch (error) {
            console.error("Error fetching rules:", error);
        }
    }

    function renderAccordion(categories) {
        accordionRoot.innerHTML = categories.map((cat, index) => `
            <div class="accordion-item" id="cat-${cat.id}">
                <div class="accordion-header" onclick="toggleAccordion('cat-${cat.id}')">
                    <span><strong class="num">${String(index + 1).padStart(2, '0')}</strong> ${cat.title}</span>
                    <span class="badge">${cat.rules.length} بند</span>
                </div>
                <div class="accordion-content">
                    <ul class="rules-list">
                        ${cat.rules.map(rule => `<li class="rule-clause">${rule.text}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    }

    window.toggleAccordion = function(id) {
        const item = document.getElementById(id);
        item.classList.toggle("active");
    };

    expandAllBtn.addEventListener("click", () => {
        document.querySelectorAll(".accordion-item").forEach(el => el.classList.add("active"));
    });

    collapseAllBtn.addEventListener("click", () => {
        document.querySelectorAll(".accordion-item").forEach(el => el.classList.remove("active"));
    });

    loadRules();
});