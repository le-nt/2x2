/* Copyright 2003-2005 ROBLOX Corporation, All Rights Reserved */

#pragma once

#include "v8tree/Instance.h"
#include "util/Extents.h"
#include "util/IHasLocation.h"

namespace G3D {	
	class RenderDevice;
}

namespace RBX {

class Primitive;
class Adorn;
class PartInstance;

extern const char *const sPVInstance;
class RBXBaseClass PVInstance
	: public Reflection::Described<PVInstance, sPVInstance, Instance >
	, public virtual IHasLocation
{
private:
	typedef Reflection::Described<PVInstance, sPVInstance, Instance > Super;
	int legacyController;

protected:

	PVInstance(const char* name);

public:
	virtual ~PVInstance();

	// Historical player controllers are now supplied by Player.Character.
	// Motor and autonomous controller modes need separate native support.
	enum ControllerType { CONTROLLER_NONE=0, CONTROLLER_KEYBOARD_RIGHT=1,
		CONTROLLER_KEYBOARD_LEFT=2, CONTROLLER_JOYPAD1=3, CONTROLLER_JOYPAD2=4,
		CONTROLLER_CHASE=5, CONTROLLER_FLEE=6, CONTROLLER_PLAYER=7 };
	ControllerType getLegacyController() const { return static_cast<ControllerType>(legacyController); }
	void setLegacyController(ControllerType value);

	/*override*/ int getPersistentDataCost() const 
	{
		return Super::getPersistentDataCost() + 6;
	}
	
protected:
	/////////////////////////////////////////////////////////////
	// INSTANCE
	//
	/*override*/ virtual void readProperty(const XmlElement* propertyElement, IReferenceBinder& binder);

	////////////////////////////////////////////////////////////////////////
	// PVINSTANCE
	//
	void renderCoordinateFrame(Adorn* adorn);
	/*implement*/ virtual bool hitTestImpl(const RBX::RbxRay& worldRay, Vector3& worldHitPoint) = 0;
public:
	/*implement*/ virtual Extents computeExtentsWorld() const = 0;
	/*implement*/ virtual PartInstance* getPrimaryPart() = 0;	

	////////////////////////////////////////////////////////////////////////
	// SCRIPT FUNCTIONS - .cpp file uses workspace.h
	//
	// These are functions used by Lua.  They can be renamed as necessary.  These
	// functions apply to both Parts and Models, which can be handy.
	//
	// moveToPoint - attemps to move the PVInstance to the point given in world coordinates.
	// Parts and Models have a "SnapLocation" - given by the center of a part, or the center
	// of a model's PrimaryPart.

	void moveToPointNoUnjoinNoJoin(Vector3 point);

	void moveToPointAndJoin(Vector3 point);

	void moveToPointNoJoin(Vector3 point);	

	bool hitTest(const RBX::RbxRay& worldRay, Vector3& worldHitPoint) {
		return hitTestImpl(worldRay, worldHitPoint);
	}

	////////////////////////////////////////////////////////////////////////
	// Utilities - mirrors of Instance functions cast to PVInstance
	//

	PVInstance* getTopLevelPVParent();					// is right below the root

	const PVInstance* getTopLevelPVParent() const;		// is right below the root

	bool isTopLevelPVInstance() const	{
		return (	(queryTypedParent<PVInstance>() == NULL)
				||	(getTypedRoot<PVInstance>() == getTypedParent<PVInstance>()));
	}

	////////////////////////////////////////////////////////////////////////
	// LEGACY
	// Legacy CanSelect - changed to Locked 1/1/06
	// void setCanSelectLegacy(bool set) {setLocked(!set);}

	// Legacy Offset - pre 11/20/2005 - now all parts store in global
    CoordinateFrame getPVGridOffsetLegacy() const{return CoordinateFrame(Vector3(0, 0, 0));}
	void setPVGridOffsetLegacy(const CoordinateFrame& _offset);
};

} // namespace
