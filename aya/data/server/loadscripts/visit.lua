-- Play solo in Studio: Aya Studio runs this from /game/visit.ashx when its
-- Play button starts a playtest. The Site fills in the place, and the player's
-- UserId and avatar for the signed-in user (routes/(rbxclient)/game/visit).
-- Scripts can't rename the local player, so it plays as "Player".
pcall(function() game:SetPlaceID(_PLACE_ID) end)

local message = Instance.new("Message")
message.archivable = false
message.Parent = workspace

pcall(function() settings().Diagnostics:LegacyScriptMode() end)
pcall(function() game:GetService("InsertService"):SetAssetUrl(_BASE_URL .. "/Asset/?id=%d") end)
pcall(function() game:GetService("InsertService"):SetAssetVersionUrl(_BASE_URL .. "/Asset/?assetversionid=%d") end)
game:GetService("ChangeHistoryService"):SetEnabled(false)
workspace:SetPhysicsThrottleEnabled(true)

local step = "starting"
local success, err = pcall(function()
	step = "running the place"
	game:GetService("RunService"):Run()

	step = "creating the player"
	local player = game:GetService("Players"):CreateLocalPlayer(_USER_ID)
	if _CHARACTER_APPEARANCE ~= "" then
		step = "setting the avatar"
		player.CharacterAppearance = _CHARACTER_APPEARANCE
	end

	local hasProperty, autoLoads = pcall(function() return game:GetService("Players").CharacterAutoLoads end)
	if not hasProperty or autoLoads then
		step = "loading the character"
		player:LoadCharacter()
	end

	pcall(function() player:SetMembershipType(Enum.MembershipType.None) end)
	pcall(function() player:SetAccountAge(0) end)
end)

if success then
	message.Parent = nil
else
	message.Text = "Error on visit (" .. step .. "): " .. tostring(err)
end
