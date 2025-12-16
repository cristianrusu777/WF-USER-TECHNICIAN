function highlightSelectedTier(buttons, tier) {
    buttons.forEach(btn => btn.classList.remove("selected"));
    buttons.forEach(btn => {
        if (btn.dataset.tier === tier) btn.classList.add("selected");
    });
}

function setupSubscriptionButtons() {
    const buttons = document.querySelectorAll(".subscriptionBtn");
    const popup = document.getElementById("confirmPopup");
    // Prefer per-user tier if available via auth.js helpers
    let selectedTier = (window.Auth && Auth.getCurrentUser() && Auth.getUserTier(Auth.getCurrentUser())) || localStorage.getItem("tier") || "Basic";
    let pendingTier = null;

    popup.style.display = "none";
    highlightSelectedTier(buttons, selectedTier);

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            pendingTier = btn.dataset.tier;
            if (pendingTier === "Custom") {
                popup.innerHTML = `
                    <p>Contact us to get a custom formula:</p>
                    <form id="customForm">
                        <input type="text" placeholder="First Name" required><br>
                        <input type="text" placeholder="Last Name" required><br>
                        <input type="email" placeholder="Email" required><br>
                        <button type="button" id="sendBtn">Send</button>
                        <button type="button" id="cancelBtn">Cancel</button>
                    </form>
                `;
                popup.style.display = "block";
                document.querySelector("main").style.filter = "blur(2px)";

                document.getElementById("sendBtn").addEventListener("click", () => {
                    popup.style.display = "none";
                });

                document.getElementById("cancelBtn").addEventListener("click", () => {
                    popup.style.display = "none";
                });
            } else {
                // Require login to manage subscription
                if (!(window.Auth && Auth.getCurrentUser())) {
                    window.location = './user-login.html?redirect=subs.html';
                    return;
                }
                popup.innerHTML = `
                    <p>Are you sure you want to purchase the selected subscription?</p>
                    <button id="cancelBtn">Cancel</button>
                    <button id="acceptBtn">Accept</button>
                `;
                popup.style.display = "block";
                document.querySelector("main").style.filter = "blur(2px)";

                document.getElementById("cancelBtn").addEventListener("click", () => {
                    pendingTier = null;
                    popup.style.display = "none";
                    document.querySelector("main").style.filter = "none";
                });

                document.getElementById("acceptBtn").addEventListener("click", () => {
                    selectedTier = pendingTier;
                    // Save per-user and legacy global key for compatibility
                    try {
                        if (window.Auth && Auth.getCurrentUser()) {
                            Auth.setUserTier(Auth.getCurrentUser(), selectedTier);
                        }
                    } catch(e) {}
                    localStorage.setItem("tier", selectedTier);
                    highlightSelectedTier(buttons, selectedTier);
                    pendingTier = null;
                    popup.style.display = "none";
                    document.querySelector("main").style.filter = "none";
                });
            }
        });
    });
}

setupSubscriptionButtons();
