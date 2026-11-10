local mathUtility = {}

mathUtility.tau = 2 * math.pi

function mathUtility.lerp(a, b, t)
    return a + t * (b - a)
end

function mathUtility.clamp(low, high, value)
	if low <= high then
		return math.min(high, math.max(low, value))
	end
	
	return value
end

function mathUtility.approach(value, target, amount) 
    return value + mathUtility.clamp(-math.abs(amount), math.abs(amount), target - value);
end

function mathUtility.round(value, places)
	places = places or 0
	local decimalPivot = 10^places
	
	return math.floor(value * decimalPivot + 0.5) / decimalPivot
end

return mathUtility
