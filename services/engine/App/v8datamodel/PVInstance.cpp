/* Copyright 2003-2005 ROBLOX Corporation, All Rights Reserved */
#include "stdafx.h"

#include "v8datamodel/PVInstance.h"
#include "v8datamodel/UserController.h"
#include "v8datamodel/Workspace.h"
#include "util/Math.h"
#include "util/Action.h"
#include "rbx/Debug.h"
#include "appdraw/DrawAdorn.h"
#include "GfxBase/Part.h"
#include "GfxBase/Adorn.h"



namespace RBX {

namespace Reflection {
template<> EnumDesc<PVInstance::ControllerType>::EnumDesc() : EnumDescriptor("ControllerType")
{
	// Verified against the 2009E native enum registration at 0x685254.
	addPair(PVInstance::CONTROLLER_NONE, "None");
	addPair(PVInstance::CONTROLLER_KEYBOARD_RIGHT, "KeyboardRight");
	addPair(PVInstance::CONTROLLER_KEYBOARD_LEFT, "KeyboardLeft");
	addPair(PVInstance::CONTROLLER_JOYPAD1, "Joypad1");
	addPair(PVInstance::CONTROLLER_JOYPAD2, "Joypad2");
	addPair(PVInstance::CONTROLLER_CHASE, "Chase");
	addPair(PVInstance::CONTROLLER_FLEE, "Flee");
	addPair(PVInstance::CONTROLLER_PLAYER, "Player");
}
template<> PVInstance::ControllerType& Variant::convert<PVInstance::ControllerType>()
{
	return genericConvert<PVInstance::ControllerType>();
}
}

template<> bool StringConverter<PVInstance::ControllerType>::convertToValue(const std::string& text, PVInstance::ControllerType& value)
{
	return Reflection::EnumDesc<PVInstance::ControllerType>::singleton().convertToValue(text.c_str(), value);
}

const char *const sPVInstance = "PVInstance";

///////////////////////////
// legacy stuff - old offset

REFLECTION_BEGIN();
static const Reflection::PropDescriptor<PVInstance, CoordinateFrame> desc_CoordFrame("CoordinateFrame", category_Data, &PVInstance::getPVGridOffsetLegacy, &PVInstance::setPVGridOffsetLegacy, Reflection::PropertyDescriptor::UI);
static const Reflection::EnumPropDescriptor<PVInstance, PVInstance::ControllerType> desc_Controller("Controller", category_Behavior, &PVInstance::getLegacyController, &PVInstance::setLegacyController);
REFLECTION_END();

PVInstance::PVInstance(const char* name) :
	Reflection::Described<PVInstance, sPVInstance, Instance >(name), legacyController(CONTROLLER_NONE)
{
}

void PVInstance::setLegacyController(ControllerType value)
{
	if (value != CONTROLLER_NONE && value != CONTROLLER_PLAYER)
		throw std::runtime_error("Legacy Controller motor/AI mode is not supported by this runtime");
	// Player mode is fulfilled by the native Player.Character ownership and
	// Humanoid input pipeline, including models assigned after this property.
	if (legacyController != value) {
		legacyController = value;
		raisePropertyChanged(desc_Controller);
	}
}

void PVInstance::moveToPointNoUnjoinNoJoin(Vector3 point)
{
	if (Workspace* workspace = Workspace::findWorkspace(this)) {
		workspace->moveToPoint(this, point, DRAG::NO_UNJOIN_NO_JOIN);
	}
}


void PVInstance::moveToPointAndJoin(Vector3 point)
{
	if (Workspace* workspace = Workspace::findWorkspace(this)) {
		workspace->moveToPoint(this, point, DRAG::UNJOIN_JOIN);
	}
}

void PVInstance::moveToPointNoJoin(Vector3 point)
{
	if (Workspace* workspace = Workspace::findWorkspace(this)) {
		workspace->moveToPoint(this, point, DRAG::UNJOIN_NO_JOIN);
	}
}

void PVInstance::readProperty(const XmlElement* propertyElement, IReferenceBinder& binder)
{
	
	// If the element is an Feature and the Feature does not exist, create it
	if (propertyElement->getTag()=="Feature")
	{
		const RBX::Name* name = NULL;
		bool foundNameAttribute = propertyElement->findAttributeValue(name_name, name);
		RBXASSERT(foundNameAttribute);
		if (*name=="Part")
		{
			// Read legacy PartInstance data
			this->readProperties(propertyElement, binder);
			return;
		}
		else if (*name=="Item")
		{
			// Read legacy PVAttribute data
			this->readProperties(propertyElement, binder);
			return;
		}
	}

	Super::readProperty(propertyElement, binder);
}


PVInstance::~PVInstance()
{
}


PVInstance* PVInstance::getTopLevelPVParent()
{
	if (isTopLevelPVInstance()) {						// no parent, or parent==root
		return this;
	}
	else {
		return getTypedParent<PVInstance>()->getTopLevelPVParent();
	}
}

const PVInstance* PVInstance::getTopLevelPVParent() const
{
	if (isTopLevelPVInstance()) {						// no parent, or parent==root
		return this;
	}
	else {
		return getTypedParent<PVInstance>()->getTopLevelPVParent();
	}
}

void PVInstance::renderCoordinateFrame(Adorn* adorn) 
{
	adorn->setObjectToWorldMatrix( getLocation() );
	adorn->axes(G3D::Color3::red(), G3D::Color3::green(),
		G3D::Color3::blue(), 10.0);
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////


	// UI versions
void PVInstance::setPVGridOffsetLegacy(const CoordinateFrame& _offset) 
{
	throw RBX::runtime_error("CoordinateFrame is not a valid member of %s", getDescriptor().name.c_str());
}




} // namespace RBX
