local Signal = {}

--===========================================================================
-- createSignal
-- Used for FAST, internal engine events.
--
-- Architecture Context: This is a lightweight, pure-Luau replacement for
-- `BindableEvent` (the C++ backed event system). By keeping
-- the event routing entirely within Luau, we avoid the heavy performance cost
-- of crossing the Lua/C++ boundary and the overhead of serializing arguments.
--
-- Unlike createSafeSignal (below), this executes callbacks directly without the overhead
-- of a `pcall`. If an internal engine listener throws an error, we want it to
-- halt execution so we can immediately catch and fix the issue.
--===========================================================================
function Signal.createSignal()
	local listeners = {}
	local signal = {}

	-- Triggers the signal, calling all connected functions with the provided arguments
	function signal:Fire(...)
		for _, callback in ipairs(listeners) do
			callback(...)
		end
	end

	-- Connects a new function to the signal to be called whenever it is fired
	function signal:Connect(callback)
		table.insert(listeners, callback)

		local connection = {
			Connected = true,
		}

		-- Removes the callback from the listeners list so it stops firing
		function connection.Disconnect()
			if not connection.Connected then
				return
			end

			connection.Connected = false

			local index = table.find(listeners, callback)
			if index then
				table.remove(listeners, index)
			end
		end

		return connection
	end

	-- Clears out all connections at once, useful for memory cleanup
	function signal:Destroy()
		table.clear(listeners)
	end

	return signal
end

--===========================================================================
-- createSafeSignal
-- Used for PUBLIC-facing events.
--
-- Architecture Context: Like `createSignal` above, this is a fast, pure-Luau
-- alternative to `BindableEvent` that avoids C++ bridge overhead. However,
-- it trades a tiny bit of speed for an execution safety net.
--===========================================================================
function Signal.createSafeSignal()
	local listeners = {}
	local signal = {}

	-- Triggers the signal, safely wrapping each callback in a pcall to isolate errors.
	-- Snapshots the listener list before iterating so a Disconnect inside a callback
	-- does not corrupt the iteration.
	function signal:Fire(...)
		for _, callback in ipairs(table.clone(listeners)) do
			local ok, err = pcall(callback, ...)

			-- If the external listener errors, log it as a warning but keep the engine running
			if not ok then
				warn(string.format("[AbilityManager] Signal error: %s", tostring(err)))
			end
		end
	end

	-- Connects a new function to the signal
	function signal:Connect(callback)
		table.insert(listeners, callback)

		local connection = {
			Connected = true,
		}

		-- Removes the callback from the listeners list
		function connection.Disconnect()
			if not connection.Connected then
				return
			end

			connection.Connected = false
			local index = table.find(listeners, callback)
			if index then
				table.remove(listeners, index)
			end
		end

		return connection
	end

	-- Clears out all connections at once
	function signal:Destroy()
		table.clear(listeners)
	end

	return signal
end

return Signal