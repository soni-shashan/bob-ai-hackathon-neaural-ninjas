from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import MaintenanceAction, Asset, Crew
from app.schemas.schemas import MaintenanceActionItem, MaintenancePlanResponse, CrewAssignResponse

class MaintenanceService:
    """
    Maintenance Prioritization and Crew Assignment Service.
    Automatically prioritizes maintenance based on composite risk scores,
    customer impact, and weather vulnerability.
    """

    @classmethod
    def get_maintenance_plan(cls, db: Session) -> MaintenancePlanResponse:
        actions = db.query(MaintenanceAction).join(Asset).order_by(MaintenanceAction.priority.asc()).all()
        items = []

        for a in actions:
            crew = db.query(Crew).filter(Crew.id == a.crew_id).first() if a.crew_id else None
            
            # Dynamic ETA based on priority
            eta = 15 + a.priority * 7

            # Calculate dynamic risk score based on asset health
            if a.asset:
                health = a.asset.health_score
                act_risk = min(98, max(12, int(round(100 - health + (14 if health < 50 else 5)))))
            else:
                act_risk = 75

            items.append(MaintenanceActionItem(
                id=a.id,
                priority=a.priority,
                asset_id=a.asset_id,
                asset_name=a.asset.name if a.asset else f"Asset {a.asset_id}",
                location=a.asset.substation if a.asset else "Unknown Substation",
                risk_score=act_risk,
                action=a.action,
                crew_id=a.crew_id,
                crew_name=crew.name if crew else "Unassigned",
                status=a.status,
                eta_minutes=eta,
                recommended_start=a.scheduled_time,
                reason=a.reason,
                expected_risk_reduction_pct=a.expected_risk_reduction_pct or 50
            ))

        return MaintenancePlanResponse(
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_actions=len(items),
            actions=items
        )

    @classmethod
    def assign_crew(cls, db: Session, asset_id: str, crew_id: str) -> CrewAssignResponse:
        action = db.query(MaintenanceAction).filter(MaintenanceAction.asset_id == asset_id).first()
        crew = db.query(Crew).filter(Crew.id == crew_id).first()
        asset = db.query(Asset).filter(Asset.id == asset_id).first()

        if not asset:
            return CrewAssignResponse(
                success=False,
                asset_id=asset_id,
                crew_id=crew_id,
                status="FAILED",
                message=f"Asset {asset_id} not found."
            )

        if not crew:
            return CrewAssignResponse(
                success=False,
                asset_id=asset_id,
                crew_id=crew_id,
                status="FAILED",
                message=f"Crew {crew_id} not found."
            )

        if action:
            action.crew_id = crew_id
            action.status = "ASSIGNED"
        else:
            action = MaintenanceAction(
                id=f"MA-AUTO-{asset_id}",
                asset_id=asset_id,
                crew_id=crew_id,
                priority=1,
                action="Emergency Preventive Inspection",
                status="ASSIGNED",
                scheduled_time=datetime.now(timezone.utc).isoformat(),
                estimated_duration_hours=4.0,
                reason=f"Immediate intervention assigned to {crew.name}.",
                expected_risk_reduction_pct=65
            )
            db.add(action)

        crew.status = "ASSIGNED"
        crew.assigned_asset_id = asset_id

        db.commit()

        return CrewAssignResponse(
            success=True,
            asset_id=asset_id,
            crew_id=crew_id,
            status="ASSIGNED",
            message=f"{crew.name} successfully assigned to {asset.name} at {asset.substation}."
        )

maintenance_service = MaintenanceService()
