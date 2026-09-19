"""
Maintenance Ticket API router.
Allows raising, assigning, tracking, and resolving maintenance & fix-issue tickets for grid assets.
"""
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database.session import get_db
from app.models.models import User, Asset, Crew, MaintenanceTicket, TicketActivity
from app.schemas.schemas import (
    TicketCreate,
    TicketUpdate,
    TicketResponse,
    TicketActivityResponse,
    TicketCommentCreate,
)
from app.api.auth_deps import get_current_user, require_main_admin, require_permission

router = APIRouter(prefix="/tickets", tags=["Maintenance Tickets"])



def _format_ticket_response(ticket: MaintenanceTicket) -> TicketResponse:
    """Formats a MaintenanceTicket ORM object into TicketResponse Pydantic schema."""
    activities_resp = [
        TicketActivityResponse(
            id=act.id,
            ticket_id=act.ticket_id,
            user_id=act.user_id,
            user_name=act.user.name if act.user else "Unknown User",
            user_email=act.user.email if act.user else "",
            action=act.action,
            comment=act.comment,
            timestamp=act.timestamp,
        )
        for act in (ticket.activities or [])
    ]

    return TicketResponse(
        id=ticket.id,
        asset_id=ticket.asset_id,
        asset_name=ticket.asset.name if ticket.asset else ticket.asset_id,
        asset_health=ticket.asset.health_score if ticket.asset else None,
        asset_risk_score=ticket.asset.risk_score if ticket.asset else None,
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority,
        status=ticket.status,
        created_by_user_id=ticket.created_by_user_id,
        created_by_name=ticket.created_by.name if ticket.created_by else "Unknown",
        assigned_to_user_id=ticket.assigned_to_user_id,
        assigned_to_name=ticket.assigned_to.name if ticket.assigned_to else None,
        assigned_crew_id=ticket.assigned_crew_id,
        assigned_crew_name=ticket.crew.name if ticket.crew else None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        due_date=ticket.due_date,
        resolution_notes=ticket.resolution_notes,
        activities=activities_resp,
    )


@router.get("", response_model=List[TicketResponse])
def list_tickets(
    asset_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    assigned_to: Optional[int] = Query(None, alias="assigned_to_user_id"),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all maintenance tickets with optional status, priority, asset, assignment, and search filters.
    """
    query = (
        db.query(MaintenanceTicket)
        .options(
            joinedload(MaintenanceTicket.asset),
            joinedload(MaintenanceTicket.created_by),
            joinedload(MaintenanceTicket.assigned_to),
            joinedload(MaintenanceTicket.crew),
            joinedload(MaintenanceTicket.activities).joinedload(TicketActivity.user),
        )
    )

    if asset_id:
        query = query.filter(MaintenanceTicket.asset_id == asset_id)
    if status_filter:
        query = query.filter(MaintenanceTicket.status == status_filter.upper())
    if priority:
        query = query.filter(MaintenanceTicket.priority == priority.upper())
    if assigned_to:
        query = query.filter(MaintenanceTicket.assigned_to_user_id == assigned_to)
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            (MaintenanceTicket.title.ilike(search_term))
            | (MaintenanceTicket.id.ilike(search_term))
            | (MaintenanceTicket.description.ilike(search_term))
            | (MaintenanceTicket.asset_id.ilike(search_term))
        )

    tickets = query.order_by(MaintenanceTicket.updated_at.desc()).all()
    return [_format_ticket_response(t) for t in tickets]


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def raise_ticket(
    body: TicketCreate,
    current_user: User = Depends(require_permission("tickets", "rw")),
    db: Session = Depends(get_db),
):

    """
    Raise a new maintenance & fix-issue ticket for a grid asset.
    """
    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == body.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{body.asset_id}' not found.",
        )

    # Generate sequential Ticket ID
    existing_count = db.query(MaintenanceTicket).count()
    ticket_id = f"TKT-2026-{existing_count + 1:03d}"
    now_iso = datetime.now(timezone.utc).isoformat()

    ticket = MaintenanceTicket(
        id=ticket_id,
        asset_id=body.asset_id,
        title=body.title.strip(),
        description=body.description.strip(),
        priority=(body.priority or "MEDIUM").upper(),
        status="OPEN",
        created_by_user_id=current_user.id,
        assigned_to_user_id=body.assigned_to_user_id,
        assigned_crew_id=body.assigned_crew_id,
        created_at=now_iso,
        updated_at=now_iso,
        due_date=body.due_date,
    )
    db.add(ticket)
    db.flush()

    # Log initial creation activity
    initial_act = TicketActivity(
        ticket_id=ticket.id,
        user_id=current_user.id,
        action="CREATED",
        comment=f"Ticket raised with priority {ticket.priority} for asset {asset.name} ({asset.id}).",
        timestamp=now_iso,
    )
    db.add(initial_act)

    db.commit()

    # Reload full object with relationships
    t = (
        db.query(MaintenanceTicket)
        .options(
            joinedload(MaintenanceTicket.asset),
            joinedload(MaintenanceTicket.created_by),
            joinedload(MaintenanceTicket.assigned_to),
            joinedload(MaintenanceTicket.crew),
            joinedload(MaintenanceTicket.activities).joinedload(TicketActivity.user),
        )
        .filter(MaintenanceTicket.id == ticket_id)
        .first()
    )
    return _format_ticket_response(t)


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get detailed view of a ticket including asset context, assignees, and timeline activities.
    """
    ticket = (
        db.query(MaintenanceTicket)
        .options(
            joinedload(MaintenanceTicket.asset),
            joinedload(MaintenanceTicket.created_by),
            joinedload(MaintenanceTicket.assigned_to),
            joinedload(MaintenanceTicket.crew),
            joinedload(MaintenanceTicket.activities).joinedload(TicketActivity.user),
        )
        .filter(MaintenanceTicket.id == ticket_id)
        .first()
    )

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    return _format_ticket_response(ticket)


@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: str,
    body: TicketUpdate,
    current_user: User = Depends(require_permission("tickets", "rw")),
    db: Session = Depends(get_db),
):

    """
    Update ticket details, lifecycle status (OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED),
    assignee, priority, or resolution notes.
    """
    ticket = (
        db.query(MaintenanceTicket)
        .options(
            joinedload(MaintenanceTicket.asset),
            joinedload(MaintenanceTicket.created_by),
            joinedload(MaintenanceTicket.assigned_to),
            joinedload(MaintenanceTicket.crew),
            joinedload(MaintenanceTicket.activities).joinedload(TicketActivity.user),
        )
        .filter(MaintenanceTicket.id == ticket_id)
        .first()
    )

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    activity_notes = []

    if body.title is not None and body.title.strip() != ticket.title:
        ticket.title = body.title.strip()
    if body.description is not None:
        ticket.description = body.description.strip()

    if body.status is not None and body.status.upper() != ticket.status:
        old_status = ticket.status
        new_status = body.status.upper()
        ticket.status = new_status
        activity_notes.append(f"Status changed from {old_status} to {new_status}")

    if body.priority is not None and body.priority.upper() != ticket.priority:
        old_prio = ticket.priority
        ticket.priority = body.priority.upper()
        activity_notes.append(f"Priority changed from {old_prio} to {ticket.priority}")

    if body.assigned_to_user_id is not None and body.assigned_to_user_id != ticket.assigned_to_user_id:
        ticket.assigned_to_user_id = body.assigned_to_user_id
        assigned_user = db.query(User).filter(User.id == body.assigned_to_user_id).first()
        assignee_name = assigned_user.name if assigned_user else f"User #{body.assigned_to_user_id}"
        activity_notes.append(f"Assigned ticket to {assignee_name}")

    if body.assigned_crew_id is not None and body.assigned_crew_id != ticket.assigned_crew_id:
        ticket.assigned_crew_id = body.assigned_crew_id
        crew = db.query(Crew).filter(Crew.id == body.assigned_crew_id).first()
        crew_name = crew.name if crew else body.assigned_crew_id
        activity_notes.append(f"Assigned field crew: {crew_name}")

    if body.due_date is not None:
        ticket.due_date = body.due_date

    if body.resolution_notes is not None:
        ticket.resolution_notes = body.resolution_notes.strip()
        activity_notes.append("Added resolution notes.")

    ticket.updated_at = now_iso

    if activity_notes:
        act = TicketActivity(
            ticket_id=ticket.id,
            user_id=current_user.id,
            action="STATUS_CHANGE" if body.status else "ASSIGNMENT_CHANGE",
            comment="; ".join(activity_notes),
            timestamp=now_iso,
        )
        db.add(act)

    db.commit()

    # Refresh full object
    db.refresh(ticket)
    return _format_ticket_response(ticket)


@router.post("/{ticket_id}/comments", response_model=TicketResponse)
def add_ticket_comment(
    ticket_id: str,
    body: TicketCommentCreate,
    current_user: User = Depends(require_permission("tickets", "rw")),
    db: Session = Depends(get_db),
):

    """
    Add a progress note or comment to a maintenance ticket.
    """
    ticket = db.query(MaintenanceTicket).filter(MaintenanceTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    act = TicketActivity(
        ticket_id=ticket.id,
        user_id=current_user.id,
        action="COMMENT",
        comment=body.comment.strip(),
        timestamp=now_iso,
    )
    db.add(act)
    ticket.updated_at = now_iso
    db.commit()

    t = (
        db.query(MaintenanceTicket)
        .options(
            joinedload(MaintenanceTicket.asset),
            joinedload(MaintenanceTicket.created_by),
            joinedload(MaintenanceTicket.assigned_to),
            joinedload(MaintenanceTicket.crew),
            joinedload(MaintenanceTicket.activities).joinedload(TicketActivity.user),
        )
        .filter(MaintenanceTicket.id == ticket_id)
        .first()
    )
    return _format_ticket_response(t)


@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: str,
    current_user: User = Depends(require_main_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a maintenance ticket (Main Admin privilege required).
    """
    ticket = db.query(MaintenanceTicket).filter(MaintenanceTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    db.delete(ticket)
    db.commit()
    return {"message": f"Ticket '{ticket_id}' deleted successfully."}
