/**
 * An object that manages the various editors, where users can edit their program. Also manages the
 * movement between editors.
 * There are currently two editors:
 *  - Blocks: A Blockly instance
 *  - Text: A html textbox
 *
 * @constructor
 * @this {BlockPyEditor}
 */

function BlockPyEditor() {    
    
    // This tool is what actually converts text to blocks!
    this.converter = new PythonToBlocks();
    
    // HTML DOM accessors
    this.blocklyDiv = document.querySelectorAll('.blockly-div');
    
    // Blockly and CodeMirror instances
    this.blockly = null;

    // The updateStack keeps track of whether an update is percolating, to prevent duplicate update events.
    this.silenceBlock = false;
    this.silenceBlockTimer = null;
    this.silenceText = false;
    this.oldCode = ""; //DA ELIMINARE
    
    // Hack to prevent chrome errors. Forces audio to load on demand. 
    // See: https://github.com/google/blockly/issues/299
    //NON HO CAPITO BENE A COSA SERVE. FORSE PERMETTE DI RISOLVERE UN BUG IN CHROMIUM
    Blockly.WorkspaceSvg.prototype.preloadAudio_ = function() {};
    
    // Initialize subcomponents
    this.initText();
    this.initBlockly();
    
    //SERVONO SOLO INIZIALMENTE
    this.updateBlocksFromModel();
    this.updateTextFromModel();
}

/**
 * Initializes the Blockly instance (handles all the blocks). This includes
 * attaching a number of ChangeListeners that can keep the internal code
 * representation updated and enforce type checking.
 */
BlockPyEditor.prototype.initBlockly = function() {
    //alert("initBlockly");
    this.blockly = Blockly.inject(this.blocklyDiv[0],
                                  { path: "blockly/", 
                                    scrollbars: true, 
                                    zoom: {enabled: false},
                                    oneBasedIndex: false,
                                    comments: false,
                                    toolbox: this.updateToolbox(false)});

    // Register model changer
    var editor = this;
    this.blockly.addChangeListener(function(evt) {
        //alert("eventListener");
        editor.updateBlocks();
    });

    // Force the proper window size
    this.blockly.resize();
    
};

/**
 * Initializes the CodeMirror instance. This handles text editing (with syntax highlighting)
 * and also attaches a listener for change events to update the internal code represntation.
 */
BlockPyEditor.prototype.initText = function() {
    //alert("initText");
    // Register model changer
    var editor = this;
    $('.codemirror-div').keyup(function() {
        //alert("change");
        editor.updateText();
    });

};


/**
 * Actually changes the value of the CodeMirror instance
 *
 * @param {String} code - The new code for the CodeMirror
 */
BlockPyEditor.prototype.setText = function(code) {
    //alert("setText");
    if (code == undefined || code.trim() == "") {
        $('.codemirror-div').val("\n");
    } else {
        $('.codemirror-div').val(code);
    }
}

BlockPyEditor.prototype.setBlocks = function(python_code) {
    //alert("setBlocks");
    var xml_code = "";
    if (python_code !== '' && python_code !== undefined && python_code.trim().charAt(0) !== '<') {
        var result = this.converter.convertSource(python_code);
        xml_code = result.xml;
    }
    var error_code = this.converter.convertSourceToCodeBlock(python_code);
    var errorXml = Blockly.Xml.textToDom(error_code);
    if (python_code == '' || python_code == undefined || python_code.trim() == '') {
        this.blockly.clear();
    } else if (xml_code !== '' && xml_code !== undefined) {
        var blocklyXml = Blockly.Xml.textToDom(xml_code);
        try {
            this.setBlocksFromXml(blocklyXml);
        } catch (e) {
            console.error(e);
            this.setBlocksFromXml(errorXml);
        }
    } else {
        this.setBlocksFromXml(errorXml);
    }

    Blockly.Events.disable();
    this.blockly.align();
    Blockly.Events.enable();
}

BlockPyEditor.prototype.clearDeadBlocks = function() {
    //alert("clearDeadBlocks");
    var all_blocks = this.blockly.getAllBlocks();
    all_blocks.forEach(function(elem) {
        if (!Blockly.Python[elem.type]) {
            elem.dispose(true);
        }
    });
}

/**
 * Attempts to update the model for the current code file from the 
 * block workspace. Might be prevented if an update event was already
 * percolating.
 */
BlockPyEditor.prototype.updateBlocks = function() {
    //alert("updateBlocks");
    if (! this.silenceBlock) {
        try {
            var newCode = Blockly.Python.workspaceToCode(this.blockly);
        } catch (e) {
            this.clearDeadBlocks();
        }

        this.silenceText = true;
        this.setText(newCode);
    }
}

/**
 * Attempts to update the model for the current code file from the 
 * text editor. Might be prevented if an update event was already
 * percolating. Also unhighlights any lines.
 */
var timerGuard = null;
BlockPyEditor.prototype.updateText = function() {
    //alert("updateText");
    if (! this.silenceText) {
        var newCode = $('.codemirror-div').val();

        // Update Blocks
        this.silenceBlock = true;
        this.setBlocks(newCode);
        this.resetBlockSilence();
        //this.silenceBlock = false;
    }
    this.silenceText = false;
}

/**
 * Resets the silenceBlock after a short delay
 */
BlockPyEditor.prototype.resetBlockSilence = function() {
    //alert("resetBlockSilence");
    var editor = this;
    if (editor.silenceBlockTimer != null) {
        clearTimeout(editor.silenceBlockTimer);
    }
    this.silenceBlockTimer = window.setTimeout(function() {
        editor.silenceBlock = false;
        editor.silenceBlockTimer = null;
    }, 40);
};

/**
 * Updates the text editor from the current code file in the
 * model. Might be prevented if an update event was already
 * percolating.
 */
BlockPyEditor.prototype.updateTextFromModel = function() {
    //alert("updateTextFromModel");
    var code = Blockly.Python.workspaceToCode(this.blockly);
    this.setText(code);

}

/**
 * Updates the block editor from the current code file in the
 * model. Might be prevented if an update event was already
 * percolating. This can also report an error if one occurs.
 *
 * @returns {Boolean} Returns true upon success.
 */
BlockPyEditor.prototype.updateBlocksFromModel = function() {
        var code = "print('ciao')";
        this.silenceBlock = true;
        this.setBlocks(code);
        this.resetBlockSilence();
        //this.silenceBlock = false;
}

/**
 * Helper function for retrieving the current Blockly workspace as
 * an XML DOM object.
 *
 * @returns {XMLDom} The blocks in the current workspace.
 */
BlockPyEditor.prototype.getBlocksFromXml = function() {
    //alert("getBlocksFromXml");
    return Blockly.Xml.workspaceToDom(this.blockly);
}
        
/**
 * Helper function for setting the current Blockly workspace to
 * whatever XML DOM is given. This clears out any existing blocks.
 */
BlockPyEditor.prototype.setBlocksFromXml = function(xml) {
    //alert("setBlocksFromXml");
    Blockly.Xml.domToWorkspaceDestructive(xml, this.blockly);
}


/**
 * Maps short category names in the toolbox to the full XML used to
 * represent that category as usual. This is kind of a clunky mechanism
 * for managing the different categories, and doesn't allow us to specify
 * individual blocks.
 */
BlockPyEditor.CATEGORY_MAP = {
    'Variables': '<category name="Variables" custom="VARIABLE" colour="240">'+
                  '</category>',
    'Decisions': '<category name="Decisions" colour="330">'+
                    '<block type="controls_if_better"></block>'+
                    '<block type="controls_if_better"><mutation else="1"></mutation></block>'+
                    '<block type="logic_compare"></block>'+
                    '<block type="logic_operation"></block>'+
                    '<block type="logic_negate"></block>'+
                  '</category>',
    'Iteration': '<category name="Iteration" colour="300">'+
                    '<block type="controls_forEach"></block>'+
                '</category>',
    'Functions': '<category name="Functions" custom="PROCEDURE" colour="210">'+
                '</category>',
    'Classes': '<category name="Classes" colour="210">'+
                    '<block type="class_creation"></block>'+
                    '<block type="class_creation">'+
                        '<mutation value="k"></mutation>'+
                    '</block>'+
                '</category>',
    'Calculation': '<category name="Calculation" colour="270">'+
                    '<block type="math_arithmetic"></block>'+
                    '<block type="math_round"></block>'+
                '</category>',
    'Python':   '<category name="Python" colour="180">'+
                    '<block type="raw_block"></block>'+
                    '<block type="raw_expression"></block>'+
                '</category>',
    'Output':   '<category name="Output" colour="160">'+
                    '<block type="text_print"></block>'+
                    '<block type="plot_line"></block>'+
                    '<block type="plot_scatter"></block>'+
                    '<block type="plot_hist"></block>'+
                    '<block type="plot_show"></block>'+
                    '<block type="plot_title"></block>'+
                    '<block type="plot_xlabel"></block>'+
                    '<block type="plot_ylabel"></block>'+
                '</category>',
    'Turtles': '<category name="Turtles" colour="180">'+
                    '<block type="turtle_create"></block>'+
                    '<block type="turtle_forward"></block>'+
                    '<block type="turtle_backward"></block>'+
                    '<block type="turtle_left"></block>'+
                    '<block type="turtle_right"></block>'+
                    '<block type="turtle_color"></block>'+
                '</category>',
    'Values':   '<category name="Values" colour="100">'+
                    '<block type="text"></block>'+
                    '<block type="math_number"></block>'+
                    '<block type="logic_boolean"></block>'+
                '</category>',
    'Tuples': '<category name="Tuples" colour="40">'+
                '<block type="tuple_create"></block>'+
              '</category>',
    'Lists':    '<category name="Lists" colour="30">'+
                    '<block type="lists_create_with">'+
                        '<value name="ADD0">'+
                          '<block type="math_number"><field name="NUM">0</field></block>'+
                        '</value>'+
                        '<value name="ADD1">'+
                          '<block type="math_number"><field name="NUM">0</field></block>'+
                        '</value>'+
                        '<value name="ADD2">'+
                          '<block type="math_number"><field name="NUM">0</field></block>'+
                        '</value>'+
                    '</block>'+
                    '<block type="lists_create_with"></block>'+
                    '<block type="lists_create_empty"></block>'+
                    '<block type="lists_append"></block>'+
                '</category>',
    'Dictionaries': '<category name="Dictionaries" colour="0">'+
                    '<block type="dicts_create_with"></block>'+
                    '<block type="dict_get_literal"></block>'+
                '</category>',
    'Data - Parking': '<category name="Data - Parking" colour="45">'+
                    '<block type="datetime_day"></block>'+
                    '<block type="datetime_time"></block>'+
                    '<block type="logic_compare">'+
                        '<field name="OP">EQ</field>'+
                        '<value name="A">'+
                          '<block type="datetime_time">'+
                            '<mutation isNow="1"></mutation>'+
                            '<field name="HOUR">1</field>'+
                            '<field name="MINUTE">00</field>'+
                            '<field name="MERIDIAN">PM</field>'+
                          '</block>'+
                        '</value>'+
                    '</block>'+
                    '<block type="logic_compare">'+
                        '<field name="OP">EQ</field>'+
                        '<value name="A">'+
                          '<block type="datetime_day">'+
                            '<field name="DAY">Monday</field>'+
                          '</block>'+
                        '</value>'+
                    '</block>'+
                '</category>',
    'My Block' : '<category name="My block" colour="0">'+
                    '<block type="coderbot_repeat"></block>'+
                    '<block type="coderbot_moveForward"></block>'+
                    '<block type="coderbot_moveBackward"></block>'+
                    '<block type="coderbot_turnLeft"></block>'+
                    '<block type="coderbot_turnRight"></block>'+
                    '<block type="coderbot_audio_say"></block>'+
                    '<block type="coderbot_sleep"></block>'+
                    '<block type="coderbot_adv_move"></block>'+
                    '<block type="coderbot_motion_move"></block>'+
                    '<block type="coderbot_motion_turn"></block>'+
                    '<block type="coderbot_adv_motor"></block>'+
                    '<block type="coderbot_adv_stop"></block>'+
                    '<block type="coderbot_camera_photoTake"></block>'+
                    '<block type="coderbot_camera_videoRec"></block>'+
                    '<block type="coderbot_camera_videoStop"></block>'+
                    '<block type="coderbot_adv_pathAhead"></block>'+
                    '<block type="coderbot_adv_findLine"></block>'+
                    '<block type="coderbot_adv_findSignal"></block>'+
                    '<block type="coderbot_adv_findFace"></block>'+
                    '<block type="coderbot_adv_findColor"></block>'+
                    '<block type="coderbot_cam_average"></block>'+
                    '<block type="coderbot_adv_findText"></block>'+
                    '<block type="coderbot_adv_findQRCode"></block>'+
                    '<block type="coderbot_adv_findARCode"></block>'+
                    '<block type="coderbot_adv_findLogo"></block>'+
                    '<block type="coderbot_adv_find_class"></block>'+
                    '<block type="coderbot_adv_cnn_classify"></block>'+
                    '<block type="coderbot_event_generator"></block>'+
                    '<block type="coderbot_event_listener"></block>'+
                    '<block type="coderbot_event_publisher"></block>'+
                    '<block type="hashmap_get_value"></block>'+
                    '<block type="hashmap_get_keys"></block>'+
                    '<block type="coderbot_conv_get_action"></block>'+
                    '<block type="coderbot_audio_record"></block>'+
                    '<block type="coderbot_audio_play"></block>'+
                    '<block type="coderbot_audio_hear"></block>'+
                    '<block type="coderbot_audio_listen"></block>'+
                    '<block type="coderbot_sonar_get_distance"></block>'+
                '</category>',
    'Separator': '<sep></sep>'
};

/**
 * Creates an updated representation of the Toolboxes XML as currently specified in the
 * model, using whatever modules have been added or removed. This method can either set it
 * or just retrieve it for future use.
 *
 * @param {Boolean} only_set - Whether to return the XML string or to actually set the XML. False means that it will not update the toolbox!
 * @returns {String?} Possibly returns the XML of the toolbox as a string.
 */
BlockPyEditor.prototype.updateToolbox = function(only_set) {
    //alert("updateToolbox");
    var xml = '<xml id="toolbox" style="display: none">';
    var modules = ['Variables', 'Decisions', 
                    'Iteration',
                    'Calculation', 'Output', 
                    'Values', 
                    'Lists', 'Dictionaries', 'My Block'];
    var started_misc = false,
        started_values = false,
        started_data = false;
    for (var i = 0, length = modules.length; i < length; i = i+1) {
        var module = modules[i];
        if (!started_misc && ['Calculation', 'Output', 'Python'].indexOf(module) != -1) {
            started_misc = true;
            xml += BlockPyEditor.CATEGORY_MAP['Separator'];
        }
        if (!started_values && ['Values', 'Lists', 'Dictionaries', 'My Block'].indexOf(module) != -1) {
            started_values = true;
            xml += BlockPyEditor.CATEGORY_MAP['Separator'];
        }
        if (!started_data && module.slice(0, 6) == 'Data -') {
            started_data = true;
            xml += BlockPyEditor.CATEGORY_MAP['Separator'];
        }
        if (typeof module == 'string') {
            xml += BlockPyEditor.CATEGORY_MAP[module];
        } else {
            var category = '<category name="'+module.name+'" colour="'+module.color+'">';
            for (var j= 0; category_length = module.blocks.length; j = j+1) {
                var block = module.blocks[j];
                category += '<block type="'+block+'"></block>';
            }
            category += '</category>';
        }
        //'<sep></sep>'+
    }
    xml += '</xml>';

    if (only_set) {
        this.blockly.updateToolbox(xml);
        this.blockly.resize();
    } else {
        return xml;
    }
};