--[[
	Hierarchy module written by Noitulove19
]]

local hierarchy = {}

---------------------------------------
-- CHILDREN HIERARCHY --
----------------------------------------

function hierarchy:FindFirstChildOfClass(parent, className)
	for _, child in ipairs(parent:GetChildren()) do
		if child:IsA(className) then
			return child
		end
	end

	return nil
end

function hierarchy:WaitForChildOfClass(parent, className, timeOut)
	local start = time()
	timeOut = timeOut or math.huge
	
	while time() - start < timeOut do
		local child = hierarchy:FindFirstChildOfClass(parent, className)
		if child then
			return child
		end		

		wait()
	end
	
	return nil
end

function hierarchy:GetRandomChild(parent)
	local children = parent:GetChildren()
	local randomChild = children[math.random(1, #children)]

	return randomChild
end

-----------------------------------------------
-- DESCENDANTS HIERARCHY --
-----------------------------------------------

function hierarchy:GetDescendants(ancestor)
	local descendants = {}

	local function collectChildrenOfDescendant(instance)
		for _, child in ipairs(instance:GetChildren()) do
			table.insert(descendants, child)
			collectChildrenOfDescendant(child)
		end
	end

	collectChildrenOfDescendant(ancestor)
	return descendants
end

function hierarchy:FindFirstDescendant(ancestor, descendantName)
	for _, descendant in ipairs(hierarchy:GetDescendants(ancestor)) do
		if descendant.Name == descendantName then
			return descendant
		end
	end

	return nil
end

function hierarchy:FindFirstDescendantOfClass(ancestor, className)
	for _, descendant in ipairs(hierarchy:GetDescendants(ancestor)) do
		if descendant:IsA(className) then
			return descendant
		end
	end

	return nil
end

function hierarchy:WaitForDescendant(ancestor, descendantName, timeOut)
	local start = time()
	timeOut = timeOut or math.huge
	
	while time() - start < timeOut do
		local descendant = hierarchy:FindFirstDescendant(ancestor, descendantName)
		if descendant then
			return descendant
		end		

		wait()
	end
	
	return nil
end

function hierarchy:WaitForDescendantOfClass(ancestor, className, timeOut)
	timeOut = timeOut or math.huge
	local start = time()
	
	while time() - start < timeOut do
		local descendant = hierarchy:FindFirstDescendantOfClass(ancestor, className)
		if descendant then
			return descendant
		end		
		
		wait()
	end
	
	return nil
end

function hierarchy:GetRandomDescendant(ancestor)
	local descendants = hierarchy:GetDescendants(ancestor)
	local randomDescendant = descendants[math.random(1, #descendants)]

	return randomDescendant
end

-------------------------------------------
-- ANCESTORS HIERARCHY --
-------------------------------------------

function hierarchy:FindFirstAncestor(descendant, name)
	local ancestor = descendant.Parent

	while ancestor and ancestor ~= game do
		if ancestor.Name == name then
			return ancestor
		else
			ancestor = ancestor.Parent
		end
	end

	return nil
end

function hierarchy:FindFirstAncestorOfClass(descendant, className)
	local ancestor = descendant.Parent

	while ancestor and ancestor ~= game do
		if ancestor:IsA(className) then
			return ancestor
		else
			ancestor = ancestor.Parent
		end
	end

	return nil
end

return hierarchy