import {ChatUserstate} from 'tmi.js';
import config from '../config';
import { getDeaultChannels, getCustomBots, getChannelCommands, loadUserById } from './entity/User';
const tmi = require('tmi.js');

const defaultConfig = {
	options: { debug: true },
	connection: {
		reconnect: true,
		secure: true
	},
	channels: []
};

const client = config.twitch.defaultBotIdentity.length > 0 && config.twitch.defaultBotToken.length > 0 && new tmi.client({
	...defaultConfig,
	identity: {
		username: config.twitch.defaultBotIdentity,
		password: config.twitch.defaultBotToken
	},
});
const customInstances = new Map();

async function joinDefaultChannel(): Promise<void> {
    const channels = await getDeaultChannels();
    channels.forEach((c) => joinChannel(c));
}

async function connect(): Promise<void> {
    if(client) {
        await client.connect();
		await joinDefaultChannel();
	}
	
	const customBots = await getCustomBots();
	for(const {channel, name, password} of customBots) {
		await createInstance('#' + channel.toLowerCase(), name, password);
	}
}

function replacePlaceholder(message: string, tags: ChatUserstate): string {
	let fullMessage = message;
	if(tags["display-name"]) {
		fullMessage = fullMessage.replace(/\{USER\}/g, tags["display-name"]);
	}

	return fullMessage;
}

const commandsCache = new Map();
async function messageListener(channel: string, tags: ChatUserstate, message: string, self: boolean) {
	if(self) return;

	if(!commandsCache.has(channel)) {
		const commands = await getChannelCommands(channel);
		commandsCache.set(channel, commands);
	}

	const channelCommands = commandsCache.get(channel);
	if(Object.keys(channelCommands).includes(message.toLowerCase())) {
		const msg = replacePlaceholder(channelCommands[message.toLowerCase()], tags)
		publish(channel, msg);
	}
}

connect();
client && client.on('message', messageListener);

export function joinChannel(channel: string): void {
    client && client.join(channel);
}

export function partChannel(channel: string): void {
	if(client && client.channels.includes(channel)) {
		client.part(channel);
	}
}

export function publish(channel: string, message: string): void {
	if(customInstances.has(channel)) {
		customInstances.get(channel).say(channel, message);
	} else {
		client && client.say(channel, message);
	}
}

export async function createInstance(channel: string, username: string, password: string): Promise<void> {
	await deleteInstance(channel);
	partChannel(channel);

	const instance = new tmi.client({
		...defaultConfig,
		identity: {username, password},
		channels:[channel]
	});
	instance.connect();
	instance.on('message', messageListener);
	customInstances.set(channel, instance);
}

export async function deleteInstance(channel: string): Promise<void> {
	if(customInstances.has(channel)) {
		await customInstances.get(channel).disconnect();
		customInstances.delete(channel);
	}
}

export async function clearUserCommandsChache(userId: number): Promise<void> {
	const {displayName}  = (await loadUserById(userId))!;
	const fullChannel = '#' + displayName.toLowerCase();

	if(commandsCache.has(fullChannel)) {
		commandsCache.delete(fullChannel);
	}
}

export function getChannels(): string[] {
	return [...client.getChannels(), ...customInstances.keys()];
}