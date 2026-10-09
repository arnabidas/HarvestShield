
from pathlib import Path
import sys

import pandas as pd
import streamlit as st
from PIL import Image
import matplotlib.pyplot as plt


# ============================================================
# PATHS
# ============================================================

BASE = Path(__file__).resolve().parent
BACKEND_DIR = BASE / "backend"
LOGO_PATH = BASE / "assets" / "harvestshield_logo.png"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from harvestshield_backend import HarvestShieldBackend


# ============================================================
# PAGE CONFIG
# ============================================================

page_icon = "🍅"

if LOGO_PATH.exists():
    try:
        page_icon = Image.open(LOGO_PATH)
    except Exception:
        page_icon = "🍅"

st.set_page_config(
    page_title="HarvestShield Dashboard",
    page_icon=page_icon,
    layout="wide",
    initial_sidebar_state="expanded"
)


# ============================================================
# BACKEND
# ============================================================

@st.cache_resource
def load_backend():
    return HarvestShieldBackend(BASE)


try:
    hs = load_backend()
except Exception as e:
    st.error("Failed to load HarvestShield backend.")
    st.exception(e)
    st.stop()


# ============================================================
# SESSION STATE
# ============================================================

if "batches" not in st.session_state:
    st.session_state.batches = []

if "action_plan" not in st.session_state:
    st.session_state.action_plan = None

if "cold_capacity" not in st.session_state:
    st.session_state.cold_capacity = 150.0

if "transport_capacity" not in st.session_state:
    st.session_state.transport_capacity = 200.0


# ============================================================
# CSS
# ============================================================

st.markdown(
    """
<style>

:root {
    --bg: #090b0a;
    --sidebar: #080a09;
    --panel: #232524;
    --panel-2: #1c1f1d;
    --border: rgba(255,255,255,0.07);
    --text: #f3f5f4;
    --muted: #8d9690;
    --lime: #a7ef4e;
    --lime-dark: #78bf32;
    --red: #ff6558;
    --amber: #f3bc4b;
}

html {
    scroll-behavior: smooth;
}

.stApp {
    background: var(--bg);
    color: var(--text);
}

.block-container {
    max-width: 1380px;
    padding-top: 4.8rem !important;
    padding-bottom: 3rem;
}

/* Keep Streamlit header from covering page content */
header[data-testid="stHeader"] {
    background: #090b0a !important;
    height: 3.5rem !important;
}

/* Better spacing on smaller screens */
@media (max-width: 900px) {
    .block-container {
        padding-top: 4.4rem !important;
    }
}


/* ---------------------------------------------------------
   SIDEBAR
--------------------------------------------------------- */

[data-testid="stSidebar"] {
    background: var(--sidebar);
    border-right: 1px solid rgba(255,255,255,0.08);
}

[data-testid="stSidebar"] > div:first-child {
    padding-top: 1.2rem;
}

[data-testid="stSidebar"] img {
    background: white;
    border-radius: 14px;
    padding: 6px;
}

[data-testid="stSidebar"] p,
[data-testid="stSidebar"] label {
    color: #cbd1cd !important;
}

[data-testid="stSidebar"] hr {
    border-color: rgba(255,255,255,0.08);
}


/* ---------------------------------------------------------
   TYPOGRAPHY
--------------------------------------------------------- */

h1, h2, h3, h4 {
    color: #f5f7f6 !important;
}

p {
    color: #cbd1cd;
}

.hs-title {
    font-size: 3rem;
    font-weight: 800;
    letter-spacing: -1.8px;
    color: #f4f6f5;
    line-height: 1.05;
}

.hs-subtitle {
    color: #7f8983;
    font-size: 1rem;
    margin-top: 6px;
    margin-bottom: 1.5rem;
}

.hs-page-pill {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 999px;
    background: var(--lime);
    color: #0f140d !important;
    font-weight: 750;
}


/* ---------------------------------------------------------
   DASHBOARD CARDS
--------------------------------------------------------- */

.hs-stat-card {
    background: #252726;
    border-radius: 20px;
    padding: 23px 25px;
    min-height: 145px;
    border: 1px solid rgba(255,255,255,0.035);
    box-shadow: 0 8px 30px rgba(0,0,0,0.17);
    transition: all .2s ease;
}

.hs-stat-card:hover {
    transform: translateY(-3px);
    border-color: rgba(167,239,78,0.15);
}

.hs-stat-label {
    color: #b7beba;
    font-size: 0.97rem;
    margin-bottom: 12px;
}

.hs-stat-value {
    color: var(--lime);
    font-size: 2.25rem;
    font-weight: 800;
    line-height: 1;
}

.hs-stat-note {
    color: #858e88;
    margin-top: 12px;
    font-size: 0.88rem;
}


.hs-panel {
    background: #252726;
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 20px;
    padding: 22px;
    margin-bottom: 18px;
    box-shadow: 0 10px 32px rgba(0,0,0,0.16);
}

.hs-panel-title {
    color: #f1f4f2;
    font-size: 1.3rem;
    font-weight: 750;
    margin-bottom: 5px;
}

.hs-panel-sub {
    color: #828c86;
    font-size: 0.88rem;
    margin-bottom: 18px;
}


/* ---------------------------------------------------------
   PRIORITY CARDS
--------------------------------------------------------- */

.hs-priority {
    background: #242625;
    border-radius: 15px;
    border: 1px solid rgba(255,255,255,0.045);
    padding: 15px 17px;
    margin-bottom: 10px;
}

.hs-priority-high {
    border-left: 4px solid var(--red);
}

.hs-priority-medium {
    border-left: 4px solid var(--amber);
}

.hs-priority-low {
    border-left: 4px solid var(--lime);
}

.hs-priority-head {
    color: #f3f6f4;
    font-weight: 750;
    font-size: .98rem;
}

.hs-priority-meta {
    color: #929a95;
    font-size: .83rem;
    margin-top: 5px;
    line-height: 1.5;
}

.hs-priority-action {
    color: var(--lime);
    font-weight: 700;
    margin-top: 7px;
    font-size: .9rem;
}


/* ---------------------------------------------------------
   INPUTS
--------------------------------------------------------- */

[data-testid="stWidgetLabel"] p {
    color: #c2c9c4 !important;
    font-weight: 600;
}

input {
    color: #f3f6f4 !important;
}

[data-baseweb="input"] {
    background: #171a18 !important;
}

[data-testid="stFileUploader"] section {
    background: #171a18 !important;
    border: 1px dashed rgba(167,239,78,0.20);
    border-radius: 15px;
}


/* ---------------------------------------------------------
   BUTTONS
--------------------------------------------------------- */

button[kind="primary"] {
    background: var(--lime) !important;
    color: #10150d !important;
    border: none !important;
    border-radius: 11px !important;
    font-weight: 750 !important;
}

.stButton > button {
    border-radius: 11px;
}


/* ---------------------------------------------------------
   METRIC
--------------------------------------------------------- */

[data-testid="stMetric"] {
    background: #252726 !important;
    border-radius: 17px;
    border: 1px solid rgba(255,255,255,.05);
    padding: 12px 16px;
}

[data-testid="stMetricLabel"] p {
    color: #afb7b1 !important;
}

[data-testid="stMetricValue"] {
    color: #f3f6f4 !important;
}


/* ---------------------------------------------------------
   NAV RADIO
--------------------------------------------------------- */

[data-testid="stSidebar"] [role="radiogroup"] label {
    border-radius: 12px;
    padding: 7px 8px;
}

[data-testid="stSidebar"] [role="radiogroup"] label:hover {
    background: rgba(167,239,78,0.06);
}


/* ---------------------------------------------------------
   NOTICE
--------------------------------------------------------- */

.hs-notice {
    padding: 14px;
    border-radius: 13px;
    background: rgba(167,239,78,0.07);
    border: 1px solid rgba(167,239,78,0.16);
    color: #cfd9c8;
    font-size: .86rem;
    line-height: 1.55;
}


/* ---------------------------------------------------------
   TABLES
--------------------------------------------------------- */

[data-testid="stDataFrame"] {
    border-radius: 16px;
    overflow: hidden;
}


/* ---------------------------------------------------------
   MOBILE
--------------------------------------------------------- */

@media (max-width: 900px) {
    .hs-title {
        font-size: 2.3rem;
    }
}

</style>
""",
    unsafe_allow_html=True
)


# ============================================================
# HELPERS
# ============================================================

def total_batches():
    return len(st.session_state.batches)


def high_risk_count():
    return sum(
        1 for batch in st.session_state.batches
        if batch["risk"] == "HIGH"
    )


def medium_risk_count():
    return sum(
        1 for batch in st.session_state.batches
        if batch["risk"] == "MEDIUM"
    )


def low_risk_count():
    return sum(
        1 for batch in st.session_state.batches
        if batch["risk"] == "LOW"
    )


def attention_count():
    return sum(
        1 for batch in st.session_state.batches
        if batch["risk"] in ["HIGH", "MEDIUM"]
    )


def total_quantity():
    return sum(
        batch["quantity"]
        for batch in st.session_state.batches
    )


def batch_dataframe():

    rows = []

    for batch in st.session_state.batches:

        rows.append({
            "Batch": batch["batch_id"],
            "Condition":
                "Visible deterioration"
                if batch["source_label"] == "Rotten"
                else "No obvious deterioration",

            "Confidence":
                f"{batch['model_confidence'] * 100:.1f}%",

            "Risk":
                batch["risk"],

            "Score":
                batch["risk_score"],

            "Quantity kg":
                round(batch["quantity"], 1),

            "Temperature °C":
                round(batch["temperature"], 1),

            "Humidity %":
                round(batch["humidity"], 1),

            "Days":
                round(batch["days_since_harvest"], 1)
        })

    return pd.DataFrame(rows)


def render_stat_card(
    title,
    value,
    note
):

    st.markdown(
        f"""
<div class="hs-stat-card">

<div class="hs-stat-label">
{title}
</div>

<div class="hs-stat-value">
{value}
</div>

<div class="hs-stat-note">
{note}
</div>

</div>
""",
        unsafe_allow_html=True
    )


def render_priority(
    item
):

    risk = item["risk"]

    if risk == "HIGH":
        css = "hs-priority-high"

    elif risk == "MEDIUM":
        css = "hs-priority-medium"

    else:
        css = "hs-priority-low"


    priority = item.get(
        "priority",
        "-"
    )

    resource = item.get(
        "resource_used",
        "Pending allocation"
    )


    action = item.get(
        "action",
        item.get(
            "preliminary_action",
            "Review"
        )
    )


    reason = item.get(
        "reason",
        ""
    )


    st.markdown(
        f"""
<div class="hs-priority {css}">

<div class="hs-priority-head">

Priority #{priority}
&nbsp; • &nbsp;
{item['batch_id']}

</div>

<div class="hs-priority-meta">

{risk} RISK
&nbsp; • &nbsp;
{item['risk_score']}/100
&nbsp; • &nbsp;
{item['quantity']:.0f} kg

</div>

<div class="hs-priority-action">

{action}

</div>

<div class="hs-priority-meta">

Resource:
{resource}

</div>

<div class="hs-priority-meta">

{reason}

</div>

</div>
""",
        unsafe_allow_html=True
    )


def risk_distribution_chart():

    high = high_risk_count()
    medium = medium_risk_count()
    low = low_risk_count()

    total = high + medium + low

    if total == 0:

        st.info(
            "Analyze batches to populate the risk overview."
        )

        return


    fig, ax = plt.subplots(
        figsize=(4.4, 4.4)
    )

    fig.patch.set_facecolor(
        "#252726"
    )

    ax.set_facecolor(
        "#252726"
    )


    values = [
        high,
        medium,
        low
    ]


    colors = [
        "#ff6558",
        "#f3bc4b",
        "#a7ef4e"
    ]


    ax.pie(
        values,
        colors=colors,
        startangle=90,
        wedgeprops={
            "width": .40,
            "edgecolor": "#252726"
        }
    )


    ax.text(
        0,
        .06,
        str(total),
        ha="center",
        va="center",
        fontsize=25,
        fontweight="bold",
        color="white"
    )


    ax.text(
        0,
        -.13,
        "Batches",
        ha="center",
        va="center",
        fontsize=10,
        color="#aab2ad"
    )


    st.pyplot(
        fig,
        clear_figure=True
    )


    legend = pd.DataFrame({
        "Risk": [
            "High",
            "Medium",
            "Low"
        ],

        "Batches": [
            high,
            medium,
            low
        ]
    })


    st.dataframe(
        legend,
        hide_index=True,
        use_container_width=True
    )


def resource_chart():

    cold_total = (
        st.session_state
        .cold_capacity
    )

    transport_total = (
        st.session_state
        .transport_capacity
    )


    cold_used = 0.0
    transport_used = 0.0


    if st.session_state.action_plan:

        for item in (
            st.session_state
            .action_plan["plan"]
        ):

            resource = str(
                item.get(
                    "resource_used",
                    ""
                )
            ).lower()


            if resource.startswith(
                "cold storage"
            ):

                cold_used += (
                    item["quantity"]
                )


            elif resource.startswith(
                "transport"
            ):

                transport_used += (
                    item["quantity"]
                )


    df = pd.DataFrame(
        {
            "Used": [
                cold_used,
                transport_used
            ],

            "Remaining": [
                max(
                    cold_total
                    - cold_used,
                    0
                ),

                max(
                    transport_total
                    - transport_used,
                    0
                )
            ]
        },

        index=[
            "Cold Storage",
            "Transport"
        ]
    )


    st.bar_chart(
        df,
        height=260
    )


def score_chart():

    if not st.session_state.batches:

        st.info(
            "Risk-score trend will appear after batch analysis."
        )

        return


    df = pd.DataFrame(
        {
            "Batch": [
                batch["batch_id"]
                for batch
                in st.session_state.batches
            ],

            "Risk Score": [
                batch["risk_score"]
                for batch
                in st.session_state.batches
            ]
        }
    )


    df = df.set_index(
        "Batch"
    )


    st.line_chart(
        df,
        height=230
    )
# ============================================================
# DECISION TRACE
# ============================================================

def render_decision_trace(batch):

    st.markdown("### Decision Trace")

    st.caption(
        "How visual evidence and post-harvest context "
        "produce the current prototype recommendation."
    )

    condition = (
        "Visible deterioration"
        if batch["source_label"] == "Rotten"
        else "No obvious deterioration"
    )

    c1, c2, c3 = st.columns(3)

    with c1:
        st.markdown("**1. Visual Assessment**")
        st.write(condition)
        st.caption(
            f"Classifier confidence: "
            f"{batch['model_confidence'] * 100:.1f}%"
        )

    with c2:
        st.markdown("**2. Handling Context**")
        st.write(
            f"Temperature: {batch['temperature']:.1f} °C"
        )
        st.write(
            f"Humidity: {batch['humidity']:.0f}%"
        )
        st.write(
            f"Days since harvest: "
            f"{batch['days_since_harvest']:.0f}"
        )

    with c3:
        st.markdown("**3. Operational Risk**")
        st.metric(
            "Risk Score",
            f"{batch['risk_score']}/100"
        )
        st.write(
            f"Risk category: **{batch['risk']}**"
        )

    st.markdown("**4. Preliminary Recommendation**")

    st.info(
        batch.get(
            "preliminary_action",
            "Operator review required"
        )
    )

    st.caption(
        "This is the existing V0.1 heuristic. "
        "It is not a food-safety clearance or a "
        "validated remaining shelf-life prediction. "
        "V0.2 safety and marketability checks "
        "will be integrated separately."
    )

# ============================================================
# SIDEBAR
# ============================================================

with st.sidebar:

    st.markdown("<br>", unsafe_allow_html=True)

    if LOGO_PATH.exists():

        st.image(
            str(LOGO_PATH),
            use_container_width=True
        )

    else:

        st.markdown(
            "## HARVESTSHIELD"
        )


    st.caption(
        "Tata Imagination Challenge 2026"
    )


    st.divider()


    st.text_input(
        "Search",
        placeholder="Search",
        label_visibility="collapsed"
    )


 page = st.radio(
    "DASHBOARD",
    [
        "Overview",
        "Analyze Batch",
        "Batch Intelligence",
        "Resource Planner",
        "Capacity Simulator",
        "How HarvestShield Works",
        "Validation"
    ]
)

    st.divider()


    st.markdown(
        "### Prototype"
    )


    st.write(
        "🌱 **Crop:** Tomato only"
    )


    st.write(
        "🧠 **Model:** MobileNetV3-Small"
    )


    st.write(
        "⚙️ **Engine:** Explainable heuristic"
    )


    st.divider()


    if st.button(
        "Clear all batches",
        use_container_width=True
    ):

        st.session_state.batches = []

        st.session_state.action_plan = None

        st.rerun()


    st.markdown(
        """
<div class="hs-notice">

Risk score is a prototype
prioritization score.

It is not a probability of spoilage
or remaining shelf life.

</div>
""",
        unsafe_allow_html=True
    )


# ============================================================
# HEADER
# ============================================================

PAGE_HEADERS = {

    "Overview": {
        "title": "Dashboard Overview",
        "subtitle": (
            "Operational visibility across tomato batches, "
            "risk and constrained resources."
        ),
        "pill": "Tomato V0.1"
    },

    "Analyze Batch": {
        "title": "Analyze Batch",
        "subtitle": (
            "Assess visual condition and combine it with "
            "post-harvest context."
        ),
        "pill": "AI Analysis"
    },
    "Batch Intelligence": {
        "title": "Batch Intelligence",
        "subtitle": (
            "Compare operational risk across tomato batches "
            "and understand intervention priority."
        ),
        "pill": "Decision Intelligence"
    },

    "Capacity Simulator": {
        "title": "Capacity Stress Test",
        "subtitle": (
            "Explore how constrained cold storage and transport "
            "change intervention decisions."
        ),
        "pill": "What-If Analysis"
    },

    "How HarvestShield Works": {
        "title": "How HarvestShield Works",
        "subtitle": (
            "From visual condition to resource-aware "
            "intervention priority."
        ),
        "pill": "Decision Pipeline"
    },

    "Resource Planner": {
        "title": "Resource Planner",
        "subtitle": (
            "Prioritize interventions when cold storage "
            "and transport capacity are limited."
        ),
        "pill": "Decision Engine"
    },

    "Validation": {
        "title": "Validation & Methodology",
        "subtitle": (
            "Review the locked test results, model scope "
            "and prototype limitations."
        ),
        "pill": "Model Evidence"
    }
}


current_header = PAGE_HEADERS[page]


header_left, header_right = st.columns(
    [5, 1.3]
)


with header_left:

    st.markdown(
        f'''
<div class="hs-title">
{current_header["title"]}
</div>

<div class="hs-subtitle">
{current_header["subtitle"]}
</div>
''',
        unsafe_allow_html=True
    )


with header_right:

    st.markdown(
        "<div style='height:10px'></div>",
        unsafe_allow_html=True
    )

    st.markdown(
        f'''
<div style="text-align:right;">
<span class="hs-page-pill">
{current_header["pill"]}
</span>
</div>
''',
        unsafe_allow_html=True
    )


# ============================================================
# OVERVIEW
# ============================================================

if page == "Overview":

    row1 = st.columns(3)


    with row1[0]:

        render_stat_card(
            "Total Batches",
            total_batches(),
            "Currently tracked"
        )


    with row1[1]:

        render_stat_card(
            "High-Risk Batches",
            high_risk_count(),
            "Immediate attention candidates"
        )


    with row1[2]:

        render_stat_card(
            "Produce Tracked",
            f"{total_quantity():.0f} kg",
            "Across all active batches"
        )


    row2 = st.columns(3)


    with row2[0]:

        render_stat_card(
            "Need Attention",
            attention_count(),
            "High + medium risk"
        )


    with row2[1]:

        render_stat_card(
            "Cold Storage",
            f"{st.session_state.cold_capacity:.0f} kg",
            "Configured capacity"
        )


    with row2[2]:

        render_stat_card(
            "Transport",
            f"{st.session_state.transport_capacity:.0f} kg",
            "Configured capacity"
        )


    left, right = st.columns(
        [1.55, 1],
        gap="large"
    )


    with left:

        st.markdown(
            """
<div class="hs-panel-title">
Risk Distribution Overview
</div>

<div class="hs-panel-sub">
Current batch composition by operational risk.
</div>
""",
            unsafe_allow_html=True
        )

        risk_distribution_chart()


    with right:

        st.markdown(
            """
<div class="hs-panel-title">
Resource Availability
</div>

<div class="hs-panel-sub">
How much configured capacity remains available.
</div>
""",
            unsafe_allow_html=True
        )

        resource_chart()


    left2, right2 = st.columns(
        [1.55, 1],
        gap="large"
    )


    with left2:

        st.markdown(
            "### Batch Intelligence"
        )


        df = batch_dataframe()


        if df.empty:

            st.info(
                "No batches analyzed yet. "
                "Go to Analyze Batch."
            )

        else:

            st.dataframe(
                df,
                hide_index=True,
                use_container_width=True
            )


        st.markdown(
            "### Risk Score Overview"
        )

        score_chart()


    with right2:

        st.markdown(
            "### Priority Queue"
        )


        if (
            st.session_state
            .action_plan
        ):

            for item in (
                st.session_state
                .action_plan["plan"]
            ):

                render_priority(
                    item
                )


        elif st.session_state.batches:

            risk_rank = {
                "HIGH": 3,
                "MEDIUM": 2,
                "LOW": 1
            }


            ranked = sorted(
                st.session_state.batches,

                key=lambda batch: (
                    risk_rank[
                        batch["risk"]
                    ],

                    batch[
                        "risk_score"
                    ]
                ),

                reverse=True
            )


            for i, batch in enumerate(
                ranked,
                start=1
            ):

                item = {

                    "priority":
                        i,

                    "batch_id":
                        batch[
                            "batch_id"
                        ],

                    "risk":
                        batch[
                            "risk"
                        ],

                    "risk_score":
                        batch[
                            "risk_score"
                        ],

                    "quantity":
                        batch[
                            "quantity"
                        ],

                    "action":
                        batch[
                            "preliminary_action"
                        ],

                    "resource_used":
                        "Pending allocation",

                    "reason":
                        (
                            "Generate the Resource Planner "
                            "action plan for capacity allocation."
                        )
                }


                render_priority(
                    item
                )


        else:

            st.info(
                "Analyze batches to populate "
                "the priority queue."
            )


# ============================================================
# ANALYZE BATCH
# ============================================================

elif page == "Analyze Batch":



    st.caption(
        "Upload a tomato image and add "
        "the batch's current operating context."
    )


    left, right = st.columns(
        [1, 1.1],
        gap="large"
    )


    with left:

        uploaded_image = (
            st.file_uploader(
                "Tomato image",
                type=[
                    "jpg",
                    "jpeg",
                    "png"
                ]
            )
        )


        if uploaded_image:

            preview = (
                Image.open(
                    uploaded_image
                )
                .convert("RGB")
            )


            st.image(
                preview,
                caption="Uploaded image",
                use_container_width=True
            )


    with right:

        batch_id = st.text_input(
            "Batch ID",
            placeholder="Example: T102"
        )


        c1, c2 = st.columns(2)


        temperature = (
            c1.number_input(
                "Temperature (°C)",
                min_value=-5.0,
                max_value=50.0,
                value=20.0,
                step=.5
            )
        )


        humidity = (
            c2.number_input(
                "Humidity (%)",
                min_value=0.0,
                max_value=100.0,
                value=90.0,
                step=1.0
            )
        )


        c3, c4 = st.columns(2)


        days = (
            c3.number_input(
                "Days since harvest",
                min_value=0.0,
                max_value=30.0,
                value=2.0,
                step=1.0
            )
        )


        quantity = (
            c4.number_input(
                "Batch quantity (kg)",
                min_value=1.0,
                max_value=100000.0,
                value=100.0,
                step=10.0
            )
        )


        analyze = st.button(
            "Analyze Batch",
            type="primary",
            use_container_width=True
        )


    if analyze:

        if uploaded_image is None:

            st.error(
                "Please upload a tomato image."
            )


        elif not batch_id.strip():

            st.error(
                "Please enter a Batch ID."
            )


        else:

            with st.spinner(
                "HarvestShield is analyzing..."
            ):

                try:

                    uploaded_image.seek(0)


                    image = (
                        Image.open(
                            uploaded_image
                        )
                        .convert("RGB")
                    )


                    result = (
                        hs.analyze_batch(

                            image=image,

                            batch_id=
                                batch_id.strip(),

                            temperature=
                                temperature,

                            humidity=
                                humidity,

                            days_since_harvest=
                                days,

                            quantity=
                                quantity
                        )
                    )


                    st.session_state.batches = [

                        batch

                        for batch
                        in st.session_state.batches

                        if batch[
                            "batch_id"
                        ] != result[
                            "batch_id"
                        ]
                    ]


                    st.session_state.batches.append(
                        result
                    )


                    st.session_state.action_plan = None


                    st.success(
                        f"Batch {result['batch_id']} "
                        f"analyzed successfully."
                    )


                    metrics = st.columns(3)


                    condition = (
                        "DETERIORATION DETECTED"

                        if result[
                            "source_label"
                        ] == "Rotten"

                        else

                        "NO OBVIOUS DETERIORATION"
                    )


                    metrics[0].metric(
                        "Visual Condition",
                        condition
                    )


                    metrics[1].metric(
                        "Model Confidence",
                        (
                            f"{result['model_confidence']*100:.1f}%"
                        )
                    )


                    metrics[2].metric(
                        "Operational Risk",
                        (
                            f"{result['risk']} "
                            f"({result['risk_score']}/100)"
                        )
                    )


                    st.markdown(
                        "### Why this risk?"
                    )


                    for reason in (
                        result[
                            "risk_reasons"
                        ]
                    ):

                        st.write(
                            "•",
                            reason
                        )


                    if result[
                        "risk_cautions"
                    ]:

                        with st.expander(
                            "Context / cautions"
                        ):

                            for caution in (
                                result[
                                    "risk_cautions"
                                ]
                            ):

                                st.write(
                                    "•",
                                    caution
                                )


                    st.markdown(
                        "### Suggested Next Step"
                    )


                    st.success(
                        result[
                            "preliminary_action"
                        ]
                    )
                     render_decision_trace(result)


                    with st.expander(
                        "Scientific / prototype limitations"
                    ):

                        st.write(
                            result[
                                "model_disclaimer"
                            ]
                        )


                        st.write(
                            result[
                                "risk_disclaimer"
                            ]
                        )


                except Exception as e:

                    st.error(
                        "Batch analysis failed."
                    )

                    st.exception(e)


# ============================================================
# BATCH INTELLIGENCE
# ============================================================

elif page == "Batch Intelligence":

    st.caption(
        "Compare inspected tomato batches and identify "
        "which batches need attention first."
    )

    if not st.session_state.batches:
        st.info(
            "No batches available. Analyze tomato batches first."
        )

    else:
        df = batch_dataframe()

        # Summary cards
        c1, c2, c3, c4 = st.columns(4)

        c1.metric("Total Batches", total_batches())
        c2.metric("High Risk", high_risk_count())
        c3.metric("Need Attention", attention_count())
        c4.metric(
            "Total Quantity",
            f"{total_quantity():.0f} kg"
        )

        # Complete batch comparison
        st.markdown("### Batch Comparison")

        st.dataframe(
            df,
            hide_index=True,
            use_container_width=True
        )

        # Risk score visualization
        st.markdown("### Operational Risk Comparison")

        chart_df = df.set_index("Batch")[["Score"]]

        st.bar_chart(
            chart_df,
            height=320
        )

        # Attention ranking
        st.markdown("### Inspection Attention Ranking")

        ranked = (
            df.sort_values(
                by=["Score", "Days"],
                ascending=[False, False]
            )
            .reset_index(drop=True)
            .copy()
        )

        ranked.insert(
            0,
            "Attention Rank",
            range(1, len(ranked) + 1)
        )

        st.dataframe(
            ranked[
                [
                    "Attention Rank",
                    "Batch",
                    "Condition",
                    "Risk",
                    "Score",
                    "Quantity kg",
                    "Days"
                ]
            ],
            hide_index=True,
            use_container_width=True
        )

        st.info(
            "This ranking indicates inspection attention, "
            "not approval for dispatch. V0.2 safety screening, "
            "marketability checks and resource allocation "
            "will determine final handling decisions."
        )

        # Export comparison
        st.download_button(
            label="Download Batch Comparison",
            data=ranked.to_csv(index=False).encode("utf-8"),
            file_name="harvestshield_batch_comparison.csv",
            mime="text/csv"
        )

# ============================================================
# RESOURCE PLANNER
# ============================================================

elif page == "Resource Planner":



    st.caption(
        "Set limited cold-storage and "
        "transport capacity, then rank interventions."
    )


    c1, c2 = st.columns(2)


    cold_storage = (
        c1.number_input(
            "Available cold storage (kg)",
            min_value=0.0,
            max_value=1000000.0,
            value=float(
                st.session_state
                .cold_capacity
            ),
            step=10.0
        )
    )


    transport = (
        c2.number_input(
            "Available transport (kg)",
            min_value=0.0,
            max_value=1000000.0,
            value=float(
                st.session_state
                .transport_capacity
            ),
            step=10.0
        )
    )


    generate = st.button(
        "Generate Action Plan",
        type="primary",
        use_container_width=True
    )


    if generate:

        if not st.session_state.batches:

            st.warning(
                "Analyze at least one batch first."
            )


        else:

            try:

                plan = (
                    hs.generate_action_plan(

                        batches=
                            st.session_state
                            .batches,

                        cold_storage_capacity=
                            cold_storage,

                        transport_capacity=
                            transport
                    )
                )


                st.session_state.action_plan = (
                    plan
                )


                st.session_state.cold_capacity = (
                    cold_storage
                )


                st.session_state.transport_capacity = (
                    transport
                )


                st.success(
                    "Action plan generated."
                )


            except Exception as e:

                st.error(
                    "Could not generate "
                    "the action plan."
                )

                st.exception(e)


    if (
        st.session_state
        .action_plan
    ):

        st.markdown(
            "### Prioritized Intervention Plan"
        )


        for item in (
            st.session_state
            .action_plan["plan"]
        ):

            render_priority(
                item
            )


        remaining = st.columns(2)


        remaining[0].metric(
            "Cold Storage Remaining",
            (
                f"{st.session_state.action_plan['remaining_cold_storage']:.0f} kg"
            )
        )


        remaining[1].metric(
            "Transport Remaining",
            (
                f"{st.session_state.action_plan['remaining_transport']:.0f} kg"
            )
        )


        st.markdown(
            f"""
<div class="hs-notice">

{st.session_state.action_plan['prototype_notice']}

</div>
""",
            unsafe_allow_html=True
        )


# ============================================================
# VALIDATION
# ============================================================

elif page == "Validation":



    st.caption(
        "Actual locked-test results "
        "and prototype limitations."
    )


    metrics = st.columns(4)


    metrics[0].metric(
        "Test Accuracy",
        "95.64%"
    )


    metrics[1].metric(
        "Macro-F1",
        "94.90%"
    )


    metrics[2].metric(
        "Deterioration F1",
        "92.97%"
    )


    metrics[3].metric(
        "Locked Test Images",
        "298"
    )


    st.markdown(
        "### Final Test Metrics"
    )


    results = pd.DataFrame(
        {
            "Metric": [
                "Accuracy",
                "Macro-F1",
                "Weighted-F1",
                "Fresh Precision",
                "Fresh Recall",
                "Fresh F1",
                "Deterioration Precision",
                "Deterioration Recall",
                "Deterioration F1"
            ],

            "Value": [
                "95.64%",
                "94.90%",
                "95.61%",
                "95.67%",
                "98.03%",
                "96.84%",
                "95.56%",
                "90.53%",
                "92.97%"
            ]
        }
    )


    st.dataframe(
        results,
        hide_index=True,
        use_container_width=True
    )


    st.markdown(
        "### Confusion Matrix"
    )


    st.code(
        """[[199   4]
 [  9  86]]"""
    )


    st.markdown(
        "### Important limitations"
    )


    st.markdown(
        """
- The model assesses **visual condition only**.
- Model confidence is **not a probability of future spoilage**.
- The 0–100 risk score is a **prototype operational prioritization score**.
- V0.1 does **not predict exact remaining shelf life**.
- The resource planner uses a transparent heuristic and **does not claim mathematical optimality**.
- Test metrics are dataset results and **not field validation** in Indian packhouses or FPOs.
"""
    )


# ============================================================
# FOOTER
# ============================================================

st.divider()

st.caption(
    "HarvestShield V0.1 • Tomato-only research prototype • "
    "Tata Imagination Challenge 2026"
)


st.markdown('''
<style>

/* Deployment readability patch */
.stButton > button,
button[kind="primary"] {
    color: #000000 !important;
    font-weight: 800 !important;
}

.stButton > button *,
button[kind="primary"] * {
    color: #000000 !important;
    fill: #000000 !important;
    opacity: 1 !important;
}

</style>
''', unsafe_allow_html=True)
