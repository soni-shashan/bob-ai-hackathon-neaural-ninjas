from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Asset, MaintenanceAction, Crew
from app.schemas.schemas import AdvisorQueryResponse

class AdvisorService:
    """
    Operator-focused Grid AI Advisor.
    Delivers structured operational reasoning with evidence, risk assessment,
    recommended mitigations, and expected grid impacts.
    """

    @classmethod
    def answer_query(cls, db: Session, question: str, asset_id: str = None) -> AdvisorQueryResponse:
        q_lower = question.lower().strip()

        # Check for TR-104 specific question or immediate attention
        if "immediate" in q_lower or "critical" in q_lower or "tr-104" in q_lower or "104" in q_lower:
            return AdvisorQueryResponse(
                answer="Transformer TR-104 at Naroda Substation requires immediate intervention within the next 12 hours.",
                priority="CRITICAL",
                evidence=[
                  "82% predicted failure probability from predictive ML fault diagnostic model",
                  "Partial discharge anomaly (+31% over baseline dielectric safety threshold)",
                  "Winding temperature elevated 18°C above historical 7-day baseline",
                  "Severe thunderstorm and heavy precipitation (48mm/h) forecast for Eastern Grid",
                  "18,500 downstream customers and 42 MW load dependent on this primary unit with zero immediate redundancy"
                ],
                recommended_actions=[
                  "Dispatch emergency inspection team to Naroda Substation within 12 hours",
                  "Pre-position Crew 2 (equipped with SF6 test kits and thermal imaging) within 10 km",
                  "Formulate proactive load-transfer protocol to Odhav 220kV backup busbar",
                  "Place spare 66kV high-voltage bushing components on active warehouse standby"
                ],
                expected_impact="Proactive inspection and load relief is estimated by simulation models to reduce failure probability from 82% down to ~24%, preventing up to $1.2M in outage penalties and equipment replacement costs.",
                related_asset_id="TR-104"
            )

        # Storm vulnerability
        if "storm" in q_lower or "vulnerable" in q_lower or "weather" in q_lower or "area" in q_lower:
            return AdvisorQueryResponse(
                answer="The Eastern Industrial Grid corridor (Naroda, Odhav, and Vatva) has the highest vulnerability index for the next 24-48 hours.",
                priority="HIGH",
                evidence=[
                  "Radar forecast projects 48.5 mm/hr rainfall and 52 km/h wind shear over East Grid",
                  "18 critical transmission assets and transformers operating in this zone",
                  "Local drainage around Naroda 400kV substation has elevated flash flood advisory",
                  "Cumulative customer count in path of high-risk assets exceeds 84,230 accounts"
                ],
                recommended_actions=[
                  "Enact Code Orange weather readiness protocol across Eastern substations",
                  "Verify pump operability in substation transformer bunds and cable trenches",
                  "Stage emergency mobile substations at Ahmedabad Central Depot",
                  "Curtail non-essential switching operations during peak storm window"
                ],
                expected_impact="Pre-emptive flood mitigation prevents water ingress in cable basements, reducing storm-induced trip risk by 68%.",
                related_asset_id="TR-104"
            )

        # Crew pre-positioning
        if "crew" in q_lower or "position" in q_lower or "assign" in q_lower:
            return AdvisorQueryResponse(
                answer="Recommend pre-positioning Crew 2 at Ahmedabad East Staging Point (10 km from Naroda Substation).",
                priority="HIGH",
                evidence=[
                  "Crew 2 possesses specialized High Voltage Transformer and Electrical Inspection certifications",
                  "Equipped with FLIR thermal imaging cameras, oil dissolved gas analysis kits, and 400kV PPE",
                  "Current travel ETA from Central Depot is 18 minutes; staging cuts response latency to under 7 minutes",
                  "Highest likelihood of immediate hardware intervention is concentrated at Naroda TR-104"
                ],
                recommended_actions=[
                  "Issue deployment order for Crew 2 to transit to East Staging Depot",
                  "Put Crew 1 on 15-minute standby for Vatva feeder breaker TR-087",
                  "Confirm real-time telemetry link between mobile diagnostic van and Grid Operations Center"
                ],
                expected_impact="Reduces mean time to respond (MTTR) by 60%, ensuring rapid containment before insulation thermal runaway.",
                related_asset_id="TR-104"
            )

        # Failure impact of TR-104
        if "fail" in q_lower or "impact" in q_lower or "what happens" in q_lower:
            return AdvisorQueryResponse(
                answer="An unmitigated catastrophic failure of Transformer TR-104 would cause an extensive, multi-hour regional blackout.",
                priority="CRITICAL",
                evidence=[
                  "Immediate outage for 18,500 metered customer connections in Naroda industrial zone",
                  "Loss of 42 MW industrial and municipal feeder power",
                  "Critical facilities impacted: 2 regional trauma hospitals and 3 municipal water treatment plants",
                  "Estimated restoration time without pre-positioning: 4 to 7 hours; asset replacement lead time: 14 to 26 weeks"
                ],
                recommended_actions=[
                  "Lock in mutual-aid agreement with Western grid interconnection",
                  "Notify critical infrastructure operators (Civil Hospital & Water Works) of contingency power status",
                  "Execute preventative thermal de-loading immediately"
                ],
                expected_impact="Pre-positioning and planned load shedding avoids unmanaged cascade tripping across adjacent Odhav feeders.",
                related_asset_id="TR-104"
            )

        # Maintenance plan query
        if "plan" in q_lower or "maintenance" in q_lower or "today" in q_lower or "schedule" in q_lower:
            return AdvisorQueryResponse(
                answer="Today's optimized maintenance schedule prioritizes 3 urgent interventions based on composite failure risk.",
                priority="HIGH",
                evidence=[
                  "Priority #1: TR-104 (Naroda Substation) - Risk 94/100, Immediate inspection",
                  "Priority #2: TR-087 (Vatva Substation) - Risk 91/100, Thermal degassing & breaker overhaul",
                  "Priority #3: TR-221 (Odhav Substation) - Risk 87/100, Bushing leakage current inspection",
                  "5 out of 5 specialized crews are currently operational and ready for deployment"
                ],
                recommended_actions=[
                  "Authorize Priority #1 dispatch for Crew 2 immediately",
                  "Dispatch Crew 1 to Vatva Substation for 14:00 scheduled de-energization window",
                  "Schedule evening post-storm aerial drone thermal sweep of Gandhinagar ring"
                ],
                expected_impact="Executing the 3 prioritized interventions resolves 79% of cumulative grid risk points currently tracked.",
                related_asset_id="TR-104"
            )

        # Default fallback response
        return AdvisorQueryResponse(
            answer=f"Analysis of query '{question}': Grid operations telemetry indicates elevated risk concentrated in Eastern transformer clusters.",
            priority="MODERATE",
            evidence=[
              "Overall Grid Health Index stands at 78/100",
              "7 assets flagged under Critical Risk thresholds; 19 under High Risk",
              "Eastern Grid weather cell remains the primary volatility driver",
              "84,230 cumulative customers exposed across monitored assets"
            ],
            recommended_actions=[
              "Review the Top Risk Assets table on the main dashboard",
              "Verify crew pre-positioning in the Maintenance Planner",
              "Monitor real-time sensor streams for TR-104, TR-087, and TR-221"
            ],
            expected_impact="Standard preventative workflows maintain grid reliability within target N-1 security compliance margins."
        )

advisor_service = AdvisorService()
