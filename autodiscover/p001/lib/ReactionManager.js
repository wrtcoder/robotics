"use strict";

const fs = require('fs');
const Pattern = require('./Pattern');
const Utils = require('./Utils');
const Mind = require('../');

// 
// Manages the relationships between inputs and outputs
// learning from positive and negative experiences.
// 
class ReactionManager {

	constructor(options) {
		options = options || {};
		this.delimiter = options.delimiter || DEFAULT_DELIMITER;
		this.devices = options.devices || {};
		this.dataPath = options.dataPath;
		this.memory = options.memory || {};
		this.memory.inputs = {};
		this.memory.outputs = {};
		this.memory.reactions = [];
		this.options = options;
	}

	interpret(history, source) {
		console.debug('ReactionManager.prototype.interpret()', source, history && history.length);
		// Was change in pattern due to own action?
		// If due to own action, is it as expected?
		var match, input;
		if (source && history instanceof Array) {
			var pattern = Pattern.load(history);
			var vectorCode = pattern.vectorCode;
			var history = console.debug ? history.toString() : undefined;
			var id = source + this.delimiter + vectorCode;
			var match = this.memory.inputs[id];
			if (match && match.related) {
				// Add link to existing
				if (match.history !== history && match.related.indexOf(history) < 0)
					match.related.push(history);
			} else {
				// Create new
				input = {
					id: id,
					source: source,
					hash: pattern.hash,
					vectorCode: vectorCode,
					history: history,
					related: [],
					reactions: []
				};
				this.memory.inputs[input.id] = input;
			}
		}
		return match || input; // undefined => no match
	}

	reaction(input) {
		console.debug('ReactionManager.prototype.react(input)', input && input.id);
		// Avoid pain and seek pleasure (maximise affinity of reaction)
		// factor in some randomness
		var output, reaction, reactions;
		if (input && input.reactions) {
			var indexes = input.reactions
				.reduce(function(accum, reaction, index) {
					var factor = Math.pow(Math.floor(reaction.affinity * 20), 3);
					// Affinity levels range between -1 and +1;
					// Negative ones are excluded, while positive ones 
					// are made more likely exponentially 
					// depending on how close to +1 they are.
					// ie:
					// affinity +1.0 = 8000x (weight)
					// affinity +.75 = 3375x 
					// affinity +.50 = 1000x
					// affinity +.25 = 125x
					while(factor-- > 0) {
						accum.push(index);
					}
					return accum;
				}, []);
			reaction = input.reactions[Utils.random(indexes)];
			output = reaction && reaction.output;
			// Output can be undefined past this point...
			console.log('Total indexes:', indexes.length);		
			console.log('Reaction related to input: ', reaction);
			console.log('Output related to input: ', output);
		}
		// Not reacting to input? 
		// 	- Try something new
		//	- Do nothing
		if (!output && Object.keys(this.devices).length && Math.random() > 0.5) {
			var device = Utils.random(this.devices);
			var command = device.randomCommand();
			if (device && command) {
				output = {
					cmd: device.id + '.' + command,
					reactions: []
				}
				this.memory.outputs[output.cmd] = output;
			}
			console.log('Output at random: ', output);
		}
		// Process relationships
		if (output || input) {
			console.log({
				output: output,
				input: input
			});
			if (!reaction) {
				// No matched reaction? Try determine from available ones;
				reaction = this.memory.reactions.filter(r => {
					return (input && output) ? 
							// Both available? Match on both
							input.id === r.input && output.cmd === r.output :
							// Only one available? Match that one
							input && input.id === r.input || output && output.cmd === r.output;
				}).pop();
			}
			if (!reaction) {
				// Still no match? Then create one and add to list
				reaction = { input: input && input.id, output: output && output.cmd, affinity: 0, used: 0 };
				this.memory.reactions.push(reaction);
			}
			reaction.lastUsed = Utils.timestamp();
			reaction.affinity += Utils.random(0.25);
			reaction.used += 1;
			if (reaction.affinity > 1) reaction.affinity = 1;
			if (input && input.reactions && input.reactions.indexOf(reaction) < 0) {
				input.reactions.push(reaction);
			}
			if (output && output.reactions && output.reactions.indexOf(reaction) < 0) {
				output.reactions.push(reaction);
			}
		}
		// Save to file
		if (this.dataPath) {
			fs.writeFile(this.dataPath + '/memory.json', JSON.stringify(this.memory, null, 2));
		}
		// Might be undefined if no 
		// appropriate output decided.
		return output;
	}

}

if (typeof module !== 'undefined') {
  module.exports = ReactionManager;
}