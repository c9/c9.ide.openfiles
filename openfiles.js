/**
 * Openfiles plugin for Cloud9 IDE
 * @author Mostafa Eweda <mostafa@c9.io>
 * @copyright 2013, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
"use strict";
 define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "tabManager", "menus", "commands", "settings",
        "tree", "fs", "save", "ui"
    ];
    main.provides = ["openfiles"];
    return main;

    function main(options, imports, register) {
        var Plugin   = imports.Plugin;
        var tabs     = imports.tabManager;
        var menus    = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var tree     = imports.tree;
        var fs       = imports.fs;
        var save     = imports.save;
        var ui       = imports.ui;

        var Tree     = require("ace_tree/tree");
        var TreeData = require("./openfilesdp");

        /***** Initialization *****/

        var plugin        = new Plugin("Ajax.org", main.consumes);
        var emit          = plugin.getEmitter();
        var staticPrefix  = options.staticPrefix;

        // tree maximum height
        var showOpenFiles = true;
        var dragged       = false;

        // UI Elements
        var ofDataProvider, ofTree, treeParent, winFileTree;

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;

            // Hook events to get the focussed tab
            tabs.on("focusSync", update);
            tabs.on("tabDestroy", update);
            tabs.on("tabOrder", update);

            save.on("tabSavingState", refresh);

            commands.addCommand({
                name: "toggleOpenfiles",
                exec: function() {
                    toggleOpenfiles();
                }
            }, plugin);

            menus.addItemByPath("View/Open Files", new ui.item({
                type    : "check",
                checked : "[{settings.model}::user/openfiles/@show]",
                command : "toggleOpenfiles"
            }), 200, plugin);

            settings.on("read", function(e){
                // Defaults
                settings.setDefaults("user/openfiles", [["show", "true"]]);
                showOpenFiles = settings.getBool("user/openfiles/@show");
                updateVisibility(showOpenFiles);
            }, plugin);

            draw();
        }

        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;

            // ace_tree customization '.openfiles'
            ui.insertCss(require("text!./openfiles.css"), staticPrefix, plugin);

            tree.getElement("winOpenfiles", function(winOpenfiles) {
                treeParent = winOpenfiles;

                tree.getElement("winFileTree", function(winFileTreeL) {
                    winFileTree = winFileTreeL;
                });

                // Create the Ace Tree
                ofTree = new Tree(treeParent.$int);
                ofDataProvider = new TreeData();
                ofTree.renderer.setScrollMargin(0, 10);
                // Assign the dataprovider
                ofTree.setDataProvider(ofDataProvider);
                // Some global render metadata
                ofDataProvider.staticPrefix = staticPrefix;

                ofDataProvider.on("select", function(){
                    setTimeout(onSelect, 40);
                });

                // APF + DOM HACK: close page with confirmation
                ofTree.on("mousedown", function(e){
                    var domTarget = e.domEvent.target;
                    var pos = e.getDocumentPosition();
                    var node = ofDataProvider.findItemAtOffset(pos.y);
                    if (! (node && node.path && domTarget && domTarget.className === "close"))
                        return;
                    var amlPage = node.page.aml;
                    amlPage.parentNode.remove(amlPage, {});
                });

                if (showOpenFiles)
                    update();
                else
                    hideOpenFiles();

                var splitter = treeParent.parentNode.$handle;
                splitter.on("dragmove", function() {
                    dragged = true;
                    update();
                });
                splitter.on("dragdrop", function () {
                    dragged = true;
                    update();
                });

                emit("draw");
            });
        }

        /***** Methods *****/

        function update() {
            if (!showOpenFiles)
                return;

            draw();

            if (!ofTree)
                return;

            var activePanes   = tabs.getPanes(tabs.container);
            var focussedTab = tabs.focussedTab;
            // focussedTab can be the terminal or output views
            if (focussedTab && activePanes.indexOf(focussedTab.tab) === -1 && activePanes.length)
                focussedTab = activePanes[0].getPage();

            // unhook document change update listeners
            tabs.getTabs().forEach(function (tab) {
                tab.document && tab.document.off("changed", refresh);
            });

            var selected;
            var root = activePanes.map(function (pane, i) {
                return {
                    // name: pane.name (tab0 ...)
                    items: pane.getTabs()
                      .filter(function(tab){ return tab.path && tab.loaded; })
                      .map(function (tab) {
                        var node = {
                            name : fs.getFilename(tab.path),
                            path : tab.path,
                            items: [],
                            tab : tab
                         };
                         
                         tab.document.on("changed", refresh);
                         if (tab = focussedTab)
                            selected = node;
                        return node;
                    })
                };
            }).filter(function(pane){ 
                return pane.items.length; 
            }).map(function (node, i) {
                node.name = "GROUP " + (i+1);
                return node;
            });

            // Hide the openfiles
            if (!root.length)
                return hideOpenFiles();

            treeParent.show();

            if (root.length === 1)
                root = root[0];

            ofDataProvider.setRoot(root, selected);
            ofTree.resize(true);

            var maxHeight   = window.outerHeight / 5;
            var treeHeight   = ofTree.renderer.layerConfig.maxHeight + 3;

            if (dragged)
                treeParent.setHeight(Math.min(treeParent.getHeight(), treeHeight));
            else
                treeParent.setHeight(Math.min(treeHeight, maxHeight));

            ofTree.resize(true);
            ofTree.renderer.scrollCaretIntoView(ofDataProvider.$selectedNode, 0.5);
        }

        function refresh() {
            if (!showOpenFiles || !ofDataProvider)
                return;
            ofDataProvider._signal("change");
        }

        function findNode(json, path) {
            for (var i = 0; i < json.length; i++) {
                var elem = json[i];
                if(path === elem.path)
                    return elem;
                var inChilren = findNode(elem.items, path);
                if (inChilren)
                    return inChilren;
            }
            return null;
        }

        function onSelect() {
            var node = ofDataProvider.$selectedNode;
            tabs.focusTab(node.path);
        }

        function hideOpenFiles() {
            treeParent && treeParent.hide();
        }

        function toggleOpenfiles() {
            showOpenFiles = !showOpenFiles;
            settings.set("user/openfiles/@show", showOpenFiles);
            updateVisibility(showOpenFiles);
        }

        function updateVisibility(show) {
            if (treeParent && show === treeParent.visible)
                return;
            if (show)
                update();
            else
                hideOpenFiles();
            emit("visible", {value: show});
        }

        /***** Lifecycle *****/
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){

        });
        plugin.on("disable", function(){

        });
        plugin.on("unload", function(){
            loaded = false;
            drawn  = false;
        });

        function show() {
            updateVisibility(true);
        }

        function hide() {
            updateVisibility(false);
        }

        /***** Register and define API *****/
        /**
         * Openfiles view for Cloud9 IDE
         */
        plugin.freezePublicAPI({
            /**
             * Show the openfiles tree
             */
            show: show,

            /**
             * Hide the openfiles tree
             */
            hide: hide,

            /**
             * Find a node by path in the tree
             */
            findNode: findNode,

            /**
             * Trigger a compelete update of the openfiles view
             * Only applies when openfiles is visible
             */
            update: update,

            /**
             * Re-render the viewed part of the tree without having to re-create the tree data
             * Example usage: when the saving state or document content changed
             * Only applies when openfiles is visible
             */
            refresh: refresh
        });

        register(null, {
            openfiles: plugin
        });
    }
});
