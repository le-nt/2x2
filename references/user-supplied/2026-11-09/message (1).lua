--//rbxMethods.lua
--//lua interpretation of existing roblox methods and some new ones.

local RbxMethods = {}

function RbxMethods:FindFirstChildOfClass(parent, className) --//Find child of specific class in provided parent
	for i, v in next, parent:GetChildren() do
		if v:IsA(className) then
			return v
		end
	end

	return nil
end

function RbxMethods:WaitForChild(parent, childName) --//Wait for specific child in provided parent
	while not childName do
		wait(0.05)
		parent:FindFirstChild(childName)
	end

	return parent:FindFirstChild(childName)
end

function RbxMethods:GetRandomChild(parent) --//Get random child of provided parent
	local children = parent:GetChildren()
	local randomChild = children[math.random(1, #children)]

	return randomChild
end

function RbxMethods:GetDescendants(ancestor) --//Get all descendants in provided ancestor
	local descendants = {}

	local function GetChildren(instance)
		for i, v in next,instance:GetChildren() do
			table.insert(descendants, v)
			GetChildren(v)
		end
	end

	GetChildren(ancestor)
	return descendants
end

function RbxMethods:FindFirstDescendant(ancestor, descendantName) --//Find specific descendant in provided ancestor
	for i, v in next, RbxMethods:GetDescendants(ancestor) do
		if v.Name == descendantName then
			return v
		end
	end

	return nil
end

function RbxMethods:FindFirstDescendantOfClass(ancestor, className) --//Find descendant of specific class in provided ancestor
	for i, v in next, RbxMethods:GetDescendants(ancestor) do
		if v:IsA(className) then
			return v
		end
	end

	return nil
end

function RbxMethods:WaitForDescendant(ancestor, descendantName) --//Wait for specific descendant in provided ancestor
	while not descendantName do
		wait(0.05)
		RbxMethods:FindFirstDescendant(ancestor, descendantName)
	end

	return RbxMethods:FindFirstDescendant(ancestor, descendantName)
end

function RbxMethods:GetRandomDescendant(ancestor) --//Get random descendant of provided ancestor
	local descendants = RbxMethods:GetDescendants(ancestor)
	local randomDescendant = descendants[math.random(1, #descendants)]

	return randomDescendant
end

return RbxMethods