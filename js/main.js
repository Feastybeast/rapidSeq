/**
 * rapidseq: An HTML 5 implementation of a Sequence Diagram.
 *
 * Copyright 2013 Jay Ripley <armchaircorsair@gmail.com>
 *
 * Released under the Attribution-NonCommercial 4.0 
 * 	International Creative Commons License
 * @see http://creativecommons.org/licenses/by-nc/4.0/
 */
$().ready(function onReady() {

	// @see README.md\Global Values for details.
	var BOX_DIST = 3,
		GUTTER_WIDTH = 10,
		HDR_FONT = "18px Arial",
		keyDelayed = null,
		MSG_FONT = "14px Arial",
		// Don't respond to Arrows, Control Keys, etc. 
		MUTED_KEYS = [ 37, 38, 39, 40, 17, 18, 16, 20, 91 ],
		pal = document.getElementById('pallette').getContext('2d'),
		palX = null,
		palY = null,
		Y_STEP = 25;

	/**
	 * Boot function for the application.
	 */
	function app() {
		// Prep our parsing behaviors.
		$('#instructions').keyup(_parseDelayer);

		// Help window stuff!
		$('#div_helpHide a').click(function onClick() {
			$('#div_Help').hide();
		});

		$('#div_helpShow a').click(function onClick() {
			$('#div_Help').show();
		});

		// Set some defaults for the Canvas.
		pal.font = MSG_FONT;
		pal.fillStyle="black";

		// UI Scaling behaviors
		$(window).resize( scaleUI );

		scaleUI();
	};

	/**
	 * Support function: Tidies existance boxes for the diagram.
	 *
	 * @param {Object} sources datastructure to modify. 
	 * @param {Number} maxLineNum to exist objects to. 
	 */
	function capSources(sources, maxLineNum) {
		for(source in sources.objects) {
			var currObj = sources.objects[source];

			if (currObj.extant.length % 2 == 1 
				&& currObj.extant[currObj.extant.length - 1] > 0)
					currObj.extant.push(-maxLineNum); 

		}
	};

	/**
	 * Support function: manages references in instructions.
	 *
	 * @param {String} target object of the instruction. 
	 * @param {Object} sources structure to store objects. 
	 * @param {Number} lineNum this source match occured at. 
	 */
	function manageSources(target, sources, lineNum) {
		// Clean up the source name and attach it to the instruction.
		var cleanName = target.replace(/\//g, '').trim();

		/*
		 * Reference order is important for layout behaviors.
		 * Setup a basic data structure for later use.
		 */ 
		if (sources.list.indexOf(cleanName) == -1) {
			sources.list.push(cleanName);
			sources.objects[cleanName] = {
				x: 0,
				dx: 0,
				y: 0,
				dy: 0,
				extant: [ ],
				mid: 0
			};
		}

		// Handle lifecycle boxes via a basic nesting check.
		var refExtant = sources.objects[cleanName].extant;

		switch (target.indexOf('/')) {
			case -1: // There isn't a slash at all. Check stacking behaviors.
				if (refExtant.length == 0) { 
					// First appearance ...
					refExtant.push(lineNum);
				} else if (refExtant[refExtant.length - 1] < 0) {
					// The previous entry has been "destroyed", readd.
					refExtant.push(lineNum);
				}
				break;

			case 0: // Preceeding slash, should be paired.
				if (refExtant.length % 2 != 1) {
					setErrorNotice("Bad Termination of '" 
						+ cleanName + "' @ " + lineNum + "?");
				} else {
					refExtant.push(-lineNum);					
				}
				break;

			default: // Trailing slash. Only exists this command.
				if (refExtant.length % 2 != 0) {
					setErrorNotice("Badly nested one off of '" 
						+ cleanName + "' @ " + lineNum + "?");
				} else {
					refExtant.push(lineNum);
					refExtant.push(-lineNum);						
				}
				break;
		}

		// Indicate the sanitized name of the object to the callee.
		return cleanName;
	};

	/**
	 * Painting routine. Determines rendering locations then draws them.
	 *
	 * @param {Array} sources are used to indicate # and position of element tags.
	 * @param {Array} instructions are used to lay out major chart behaviors.
	 * @param {Number} numInstructions used in the setup.
	 */
	function paint(sources, instructions, numInstructions) {
		if (!Array.isArray(sources.list))
			throw "Source List Invalid";

		if (!Array.isArray(instructions))
			throw "Instruction Set Malformed";

		// Calculate layout values first ...
		var header_offset = _calculateLayoutValues(sources, instructions);
		// Wipe the board clean ...
		pal.clearRect(0, 0, palX, palY);
		// Then draw the object headers ...
		var header_offset = _paintHeaders(sources, numInstructions);
		// And finally the message passing ....
		_paintMessages(sources, instructions, header_offset);
	}

	/**
	 * Parses the instructions to pass off to the painting routine.
	 */
	function parseInstructions() {
		// @see README.md\parseInstructions() for descriptions ...
		var instructionSet = [ ],
			lineNumber = 0,
			reValidLine = /(\/?(?:\w+ *)+\/?) (<=|<-|->|=>) +(\/?(?:\w+ *)+\/?): +((?:.+ *)+)/,
			sources = {
				list: [ ],
				objects: { }
			},
			textToParse = $('#div_instructions textarea').val().split('\n');

		// Erase any error notices.
		setErrorNotice('');

		// Foreach individual line starting from the top ...
		instructions: while (parsedLine = textToParse.shift()) {
			lineNumber++;

			// Attempt to parse out specific tokens ...
			var tokens = reValidLine.exec(parsedLine);

			if (tokens == null) {
				setErrorNotice("Line " + lineNumber + " malformed.");
				return;
			}

			var instruction = [ null, 'skinny', null, null, '' ];

			instruction[0] = tokens[2];

			// Configure the instruction for the appropriate direction.
			if (tokens[2].indexOf('=') > -1)
					instruction[1] = 'fat';

			// Find the name of the source object, prep it's record.
			instruction[2] = manageSources(tokens[1], sources, lineNumber);
			// Find our destination object, prep it's record.
			instruction[3] = manageSources(tokens[3], sources, lineNumber);
			// Then append the remaining instructions.
			instruction[4] = tokens[4];
			// Then attach that instruction to the overall list.
			instructionSet.push(instruction);
		}

		// Ensure termination of existance boxes @ last line.
		capSources(sources, lineNumber);
		// Paint away.
		paint(sources, instructionSet, lineNumber);
	};


	/**
	 * Ensures the UI remains the appropriate size.
	 */
	function scaleUI() {
		var ua_width = $(window).width(),
			ua_height = $(window).height(),
			insX = Math.floor(.2 * ua_width);

		palX = Math.floor(.8 * ua_width) - 2 * GUTTER_WIDTH,
		palY = ua_height;

		// Deal with the instructions div first.
		$('#div_instructions').width(insX).height(ua_height);

		$('#div_instructions textarea').width(insX - 10).height(ua_height - 50);
		$('#pallette').width(palX).height(ua_height)
			.attr('width', palX).attr('height', ua_height);

		// Redraw the diagram by reparsing instructions.
		_parseDelayer();
	}

	/**
	 * Manages error messages for the UI.
	 *
 	 * @param {String} message to display to the UI.
	 */
	function setErrorNotice(message) {
		$('#div_errorNotice').html(message);
	}

	// Application "Private" functions.

	/**
	 * Determines the overall layout of elements in the diagram.
	 *
 	 * @param {Array} sources requests come from.
	 * @param {Array} instructions to render out methods.
	 */
	function _calculateLayoutValues(sources, instructions) {
		/*
		 * max_X: The hard cap of space available for each object. 
		 * offset_X: The accumulated X offset of all previous entries.  
		 */
		var max_X = (palX / sources.list.length),
			offset_x = GUTTER_WIDTH;

		// Begin by calculating the initial (minimal) position of each header.
		pal.font = HDR_FONT;

		for(var idx = 0; idx < sources.list.length; idx++) {
			var objName = sources.list[idx],
				obj = sources.objects[objName],
				obj_dx = _getTextWidth(objName) + 2*GUTTER_WIDTH;

			// TODO: Fix this implementation to wrap lines ...
			if (obj_dx >= max_X)
				setErrorNotice("Label #" + src_idx + " is very large.");

			_setHeaderPos(obj, offset_x, obj_dx);

			obj.y = GUTTER_WIDTH;
			obj.dy = Y_STEP;


			offset_x += obj_dx + GUTTER_WIDTH;
		}

		/* 
		 * Now let out positions based on length of messages.
		 */
		instructions: for(idx in instructions) {
			var instruction = instructions[idx],
				sourceObj = sources.objects[instruction[2]],
				source_idx = sources.list.indexOf(instruction[2]),
				targetObj = sources.objects[instruction[3]],
				target_idx = sources.list.indexOf(instruction[3]);

			/*
			 * Determine right handedness with XOR of 2 tests ...
			 *	1) {target index} - {source index} > 0. (Graphical reversal)
			 * 		(N.B. ONLY record pos'ns indicate source and targets.)
			 *  2) The Arrow is facing leftward (<-|<=).
			 */ 
			instruction[0] = (target_idx - source_idx > 0) 
				^ (instruction[0].indexOf('<') == 0);

			/*
			 * Perform easing to make room for messages.
			 *
			 * Find the minimally recognized object index for further work.
			 * 		the maximally recognized object index for further work.
			 * 		the minimal object's midpoint for an initial offset.
			 * 		and the amount of space needed to contain the message.
			 */
			var min_idx = Math.min(target_idx, source_idx),
				max_idx = Math.max(target_idx, source_idx),
				initial_offset = sources.objects[sources.list[min_idx]].mid,
				textLen = _getTextWidth(instruction[4]);

			// We have a self-referential message ...
			if (min_idx == max_idx) {
				// Recursive message @ tail entry. Trivial. Move on.
				if (min_idx == (sources.list.length - 1))	
					continue instructions;
				else // We have to consider the next entry for space purposes.
					max_idx++;
			} 

			// Check space available for each possible item ...
			for(var idx = min_idx; idx <= max_idx; idx++) {
				var currObj = sources.objects[sources.list[idx]];

				// If current space is enough, we're done.
				if ((currObj.mid - initial_offset) > textLen)
					continue instructions;
			}

			// We need to shift the final object and ALL following ones a found amount.
			// TODO: Do I need to space things out this badly?
			var extra_pixels = textLen - (currObj.mid - initial_offset);

			padding: for (var idx = --idx; idx < sources.list.length; idx ++) {
				var currObj = sources.objects[sources.list[idx]];
				_setHeaderPos(currObj, currObj.x + extra_pixels, currObj.dx);				
			} // /padding 			
		} // /instructions
	}

	/**
	 *  Support method to determine the text width of a given string.
	 *
	 * @param {String} str to measure the width of.
	 */
	function _getTextWidth(str) {
		return pal.measureText(str).width;
	}

	/**
	 * Central UI processing delay function.
	 */
	function _parseDelayer(evt) {
		if (MUTED_KEYS.indexOf(evt.keyCode) > -1)
			return;
		
		if (keyDelayed)
			clearTimeout(keyDelayed);
		
		keyDelayed = setTimeout( parseInstructions , 250 );
	}

	/**
	 *  Paint routine support method to draw headers.
	 *
	 * @param {Array} sources requests come from.
	 */
	function _paintHeaders(sources, numInstructions) {
		// Set the Text size to header.
		pal.font = HDR_FONT;

		var offset_y = 0;

		for(src_idx = 0; src_idx < sources.list.length; src_idx++) {

			var objName = sources.list[src_idx],
				currObj = sources.objects[objName],
				objBottom = currObj.y + currObj.dy;

			// Paint the Text and bounding rectangle.
			pal.strokeRect( currObj.x, currObj.y, currObj.dx, currObj.dy );
			pal.fillText(objName, currObj.x + GUTTER_WIDTH, objBottom - 6 );

			pal.beginPath();
			pal.moveTo(currObj.mid, objBottom );
			pal.lineTo(currObj.mid, (numInstructions + 3) * Y_STEP );
			pal.stroke();

			// Render out the existance boxes.
			while(currObj.extant.length > 0) {

				var terminated = currObj.extant.pop(),
					started = currObj.extant.pop(),
					lines_existed = (-(started + terminated) + 1);

				var exists_y = objBottom + started*Y_STEP - BOX_DIST;
				pal.clearRect(currObj.mid - BOX_DIST, exists_y, 2*BOX_DIST, lines_existed * Y_STEP );
				pal.strokeRect(currObj.mid - BOX_DIST, exists_y, 2*BOX_DIST, lines_existed * Y_STEP );
			}

			offset_y = Math.max( offset_y, objBottom );
		}

		return offset_y;
	}

	/**
	 * Paint routine support method to draw headers.
	 *
	 * @param {Array} sources requests come from.
	 * @param {Array} instructions to render out methods.
	 * @param {Integer} offset in px to start drawing arrows.
	 */
	function _paintMessages(sources, instructions, offset_y) {

		pal.font = MSG_FONT;

		for(step in instructions) {
			offset_y += Y_STEP;

			var curr_inst = instructions[step],
				objSource = sources.objects[curr_inst[2]],
				objTarget = sources.objects[curr_inst[3]];

			var box_offset = (curr_inst[0]) ? BOX_DIST : -BOX_DIST,
				max_x = Math.max(objSource.mid, objTarget.mid),
				message_dx = _getTextWidth(curr_inst[4]),
				min_x = Math.min(objSource.mid, objTarget.mid);
			
			// If it's a loopback ...
			if (objSource == objTarget) {
				var loop_x = objTarget.mid + box_offset + message_dx;

				// Top Horizontal
				pal.beginPath();
				pal.moveTo(objSource.mid + box_offset, offset_y);
				pal.lineTo(objSource.mid + message_dx + -3*box_offset, offset_y);
				pal.stroke();

				// Vertical ...
				pal.beginPath();
				pal.moveTo(objSource.mid + message_dx + -3*box_offset, offset_y);
				pal.lineTo(objSource.mid + message_dx + -3*box_offset, offset_y + 10);
				pal.stroke();

				// Lower portion.
				pal.beginPath();	
				pal.lineTo(objSource.mid + message_dx + -3*box_offset, offset_y + 10);
				pal.lineTo(objSource.mid - box_offset, offset_y + 10);
				pal.stroke();

				pal.fillText(curr_inst[4], min_x + -3*box_offset, offset_y - 5 );
			} else { // It's a standard bar ...
				message_dx = Math.floor( ((max_x - min_x) - message_dx) / 2);

				// Singular horizontal crossbar.
				pal.beginPath();
				pal.moveTo(objSource.mid + box_offset, offset_y);
				pal.lineTo(objTarget.mid - box_offset, offset_y);
				pal.stroke();

				pal.fillText(curr_inst[4], min_x + message_dx, offset_y - 5 );
			}

			// Then draw its undergirding arrow.
			_paintArrows(curr_inst[0], objSource, objTarget, offset_y);
		}
	}

	/**
	 * Paint routine support method to draw headers.
	 *
	 * @param {Object} sources structure used to identify elements.
	 * @param {Array} instruction for the arrow to attach to.
	 * @param {Integer} the initial y position of the triangle.
	 */
	function _paintArrows(isRightward, sourceObj, objTarget, yPos) {

		if (isRightward) {
			var initPoint = Math.max(sourceObj.mid, objTarget.mid) - 3,
				xOffset = -5;
		} else {
			var initPoint = Math.min(sourceObj.mid, objTarget.mid) + 3,
				xOffset = 5;
		}

		pal.moveTo(initPoint, yPos);
		pal.lineTo(initPoint + xOffset, yPos - 5);
		pal.lineTo(initPoint + xOffset, yPos + 5);

		pal.closePath();
		pal.fill();
	}

	/**
	 * Support routine to horizontally align header objects.
	 *
	 * @param {Object} objHeader to modify x coordinates of.
	 * @param {number} x position to place the LH corner at.
	 * @param {number} dx traversed by the header.
	 */
	function _setHeaderPos(objHeader, x, dx) {
		objHeader.x = x;
		objHeader.dx = dx;

		objHeader.mid = Math.floor((2*x + dx) / 2);		
	}

	// Begin the application.
	app();
});