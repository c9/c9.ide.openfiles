define(function(require, exports, module) {
    var oop          = require("ace/lib/oop");
    var BaseClass    = require("ace_tree/data_provider");

    function DataProvider(root) {
        BaseClass.call(this, root || {});

        this.rowHeight      = 20;
        this.innerRowHeight = 18;

        Object.defineProperty(this, "loaded", {
            get : function(){ return this.visibleItems.length; }
        });
    }

    oop.inherits(DataProvider, BaseClass);

    (function() {
        this.$sortNodes = false;

        this.getEmptyMessage = function(){
            return "No open files";
        };

        this.setRoot = function(root, selected){
            if (Array.isArray(root))
                root = {items: root};
            this.root = root || {};
            if (this.$selectedNode)
                this.$selectedNode.isSelected = false;
            this.$selectedNode = selected || this.root;
            this.$selectedNode.isSelected = true;
            this.visibleItems = [];
            this.open(this.root, true);

            // @TODO Deal with selection
            this._signal("change");
        };

    }).call(DataProvider.prototype);

    return DataProvider;
});