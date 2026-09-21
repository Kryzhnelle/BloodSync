// =========================================
// MOBILE NAVIGATION
// =========================================

const menuButton = document.getElementById("menuButton");
const navLinks = document.getElementById("navLinks");


// Only run if the elements exist on the current page
if (menuButton && navLinks) {

    menuButton.addEventListener("click", function () {

        navLinks.classList.toggle("active");

        if (navLinks.classList.contains("active")) {

            menuButton.innerHTML =
                '<i class="fa fa-times"></i>';

        } else {

            menuButton.innerHTML =
                '<i class="fa fa-bars"></i>';

        }

    });


    // Automatically close mobile menu when switching to desktop
    window.addEventListener("resize", function () {

        if (window.innerWidth > 767) {

            navLinks.classList.remove("active");

            menuButton.innerHTML =
                '<i class="fa fa-bars"></i>';

        }

    });

}


// =========================================
// DONOR SCREENING MODAL
// =========================================

document.addEventListener("DOMContentLoaded", function () {

    const openScreening =
        document.getElementById("openScreening");

    const closeScreening =
        document.getElementById("closeScreening");

    const screeningModal =
        document.getElementById("screeningModal");


    // Check if donor screening exists
    if (
        openScreening &&
        closeScreening &&
        screeningModal
    ) {

        // OPEN POPUP
        openScreening.addEventListener("click", function () {

            screeningModal.classList.add("active");

        });


        // CLOSE POPUP
        closeScreening.addEventListener("click", function () {

            screeningModal.classList.remove("active");

        });


        // CLOSE WHEN CLICKING OUTSIDE
        screeningModal.addEventListener("click", function (event) {

            if (event.target === screeningModal) {

                screeningModal.classList.remove("active");

            }

        });

    }

});


// =========================================
// DONOR ELIGIBILITY CALCULATOR
// =========================================

const calculateEligibility =
    document.getElementById("calculateEligibility");

const eligibilityResult =
    document.getElementById("eligibilityResult");


// IMPORTANT:
// Only run this code if the calculator
// exists on the current page.

if (calculateEligibility && eligibilityResult) {

    calculateEligibility.addEventListener(
        "click",
        function () {

            const age =
                Number(
                    document.getElementById("age").value
                );

            const weight =
                Number(
                    document.getElementById("weight").value
                );

            const weeks =
                Number(
                    document.getElementById("weeks").value
                );

            const healthy =
                document.getElementById("healthy").checked;

            const tattoo =
                document.getElementById("tattoo").checked;

            const alcohol =
                document.getElementById("alcohol").checked;


            // ==============================
            // CHECK REQUIRED FIELDS
            // ==============================

            if (!age || !weight || !weeks) {

                eligibilityResult.className =
                    "eligibility-result show not-eligible";

                eligibilityResult.innerHTML =
                    "Please complete all required information.";

                return;
            }


            // ==============================
            // CHECK ELIGIBILITY
            // ==============================

            let eligible = true;

            let reasons = [];


            // AGE
            if (age < 16) {

                eligible = false;

                reasons.push(
                    "You must be at least 16 years old."
                );

            }


            // WEIGHT
            if (weight < 50) {

                eligible = false;

                reasons.push(
                    "Your weight must be at least 50 kg."
                );

            }


            // DONATION INTERVAL
            if (weeks < 8) {

                eligible = false;

                reasons.push(
                    "At least 8 weeks should have passed since your last whole blood donation."
                );

            }


            // HEALTH
            if (!healthy) {

                eligible = false;

                reasons.push(
                    "You should feel healthy and well before donating."
                );

            }


            // TATTOO
            if (tattoo) {

                eligible = false;

                reasons.push(
                    "A recent tattoo or piercing may require a waiting period."
                );

            }


            // ALCOHOL
            if (alcohol) {

                eligible = false;

                reasons.push(
                    "You should not have consumed alcohol within the last 24 hours."
                );

            }


            // ==============================
            // DISPLAY RESULT
            // ==============================

            if (eligible) {

                eligibilityResult.className =
                    "eligibility-result show eligible";

                eligibilityResult.innerHTML = `
                    <strong>✓ You appear eligible to donate.</strong>
                    <br>
                    Your information meets the basic screening requirements.
                    Final eligibility will be confirmed by qualified medical staff.
                `;

            } else {

                eligibilityResult.className =
                    "eligibility-result show not-eligible";

                eligibilityResult.innerHTML = `
                    <strong>✕ You may not currently be eligible.</strong>
                    <br><br>
                    ${reasons
                        .map(reason => `• ${reason}`)
                        .join("<br>")}
                    <br><br>
                    Final eligibility should be determined by qualified medical staff.
                `;

            }

        }
    );

}

// ==============================
// PROGRESS FILL
// ==============================

const progressBars = document.querySelectorAll(".progress-fill");

progressBars.forEach(function (bar) {

    const participants = Number(bar.dataset.participants);
    const capacity = Number(bar.dataset.capacity);

    // Calculate percentage
    const percentage = (participants / capacity) * 100;

    // Update progress bar
    bar.style.width = percentage + "%";

    // Calculate remaining slots
    const remaining = capacity - participants;

    // Find the card containing this progress bar
    const card = bar.closest(".drive-card");

    // Find the remaining slots element
    const remainingSlots = card.querySelector(".remaining-slots");

    // Update remaining slots
    if (remainingSlots) {
        remainingSlots.textContent = remaining;
    }

    // Update capacity text
    const capacityNumber = card.querySelector(".capacity-number");

    if (capacityNumber) {
        capacityNumber.textContent =
            participants + " of " + capacity;
    }
});