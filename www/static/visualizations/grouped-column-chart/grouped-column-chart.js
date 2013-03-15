
(function(){
    // Simple vertical bar chart
    // -------------------------

    var GroupedColumnChart = Datawrapper.Visualizations.GroupedColumnChart = function() {

    };

    _.extend(GroupedColumnChart.prototype, Datawrapper.Visualizations.RaphaelChart.prototype, {

        // some config
        _showValueLabels: function() { return true; },

        _getRowColors: function() {
            var me = this,
                base = me.theme.colors.palette[me.get('base-color', 0)],
                bLch = d3.cie.lch(d3.rgb(base)),
                ml = Math.min(bLch.l, 50),
                colors = [];

            colors = d3.range(ml, 91, (90 - ml) / (me.chart.numRows() - 1)).map(function(l) {
                return ''+d3.cie.lch(l, bLch.c, bLch.h).rgb();
            });
            return colors;
        },

        getRowColors: function() {
            return this._getRowColors().reverse();
        },

        render: function(el) {
            el = $(el);

            this.setRoot(el);

            var me = this,
            sortBars = me.get('sort-values'),
            reverse = me.get('reverse-order'),
            c = me.initCanvas({}),
            ds = me.chart.__dataset,
            chart_width = c.w - c.lpad - c.rpad,
            series_gap = 0.05, // pull from theme
            row_gap = 0.01;
            if (!_.isUndefined(me.get('selected-row'))) {
                row = me.get('selected-row');
            }

            //if (row > me.chart.numRows() || row === undefined) row = 0;
            ///if (me.chart.numRows() > 3) {
            //    me.chart.filterRows([0,1,2]);
                //me.warn('Displaying only the first three rows of data.');
           //}

            me.init();

            // compute maximum x-label height
            var lh = 0,
                n = me.chart.dataSeries().length;
            _.each(me.chart.dataSeries(), function(series, s) {
                lh = Math.max(lh, me.labelHeight(series.name, 'series', c.w / (n)));
            });
            c.bpad = lh+10;


            me.initDimensions();

            $('.tooltip').hide();

            if (!me.theme.columnChart.cutGridLines) me.horzGrid();

            var colors = me.getRowColors();

            ds.eachRow(function(i) {
                me.setRowColor(i, colors[i % colors.length]);
            });

            _.each(me.chart.dataSeries(sortBars, reverse), function(series, s) {
                _.each(series.data, function(val, r) {
                    var d = me.barDimensions(series, s, r);
                    var fill = me.getBarColor(series, r, me.get('negative-color', false)),
                        stroke = d3.cie.lch(d3.rgb(fill)).darker(0.6).toString();
                    me.registerSeriesElement(c.paper.rect(d.x, d.y, d.w, d.h).attr({
                        'stroke': stroke,
                        'fill': fill
                    }).data('strokeCol', stroke), series, r);

                    var val_y = val >= 0 ? d.y - 10 : d.y + d.h + 10,
                        lbl_y = val < 0 ? d.y - 10 : d.y + d.h + 5,
                        lblcl = ['series'],
                        lbl_w = c.w / (n+2),
                        valign = val >= 0 ? 'top' : 'bottom',
                        halign = 'center',
                        alwaysShow = (me.chart.hasHighlight() && me.chart.isHighlighted(series)) || (d.w > 40);

                    if (false && me._showValueLabels()) {
                        // add value labels
                        me.registerSeriesLabel(me.label(d.x + d.w * 0.5, val_y, me.formatValue(series.data[r]),{
                            w: d.w,
                            align: 'center',
                            cl: 'value' + (alwaysShow ? '' : ' showOnHover')
                        }), series);
                    }

                    if (me.chart.hasHighlight() && me.chart.isHighlighted(series)) {
                        lblcl.push('highlighted');
                    }
                    if (d.bw < 30) {
                        //lblcl.push('rotate90');
                        lbl_y += 5;
                        lbl_w = 100;
                        halign = 'right';
                    }
                    if (d.bw < 20) {
                        lblcl.push('smaller');
                        lbl_w = 90;
                    }
                    // add series label
                    if (!/^X\.\d+$/.test(series.name) && r === 0) {
                        me.registerSeriesLabel(me.label(d.bx + d.bw * 0.5, lbl_y, series.name, {
                            w: lbl_w,
                            align: halign,
                            valign: valign,
                            cl: lblcl.join(' '),
                            rotate: d.bw < 30 ? -90 : 0
                        }), series);
                    }

                });
            });

            var y = c.h - me.__scales.y(0) - c.bpad;
            me.path([['M', c.lpad, y], ['L', c.w - c.rpad, y]], 'axis')
                .attr(me.theme.yAxis);

            // enable mouse events
            el.mousemove(_.bind(me.onMouseMove, me));

            if (me.chart.numRows() > 1) {
                // add legend
                var l = $('<div class="legend"></div>'),
                    xo = 0;

                me.chart.__dataset.eachRow(function(r) {
                    div = $('<div></div>');
                    div.css({
                        background: me.getBarColor(null, r),
                        width: 12,
                        height: 12,
                        position: 'absolute',
                        left: xo,
                        top: 1
                    });
                    l.append(div);
                    lbl = me.label(xo + 15, 0, me.chart.__dataset.rowName(r), {
                        valign: 'left',
                        root: l
                    });
                    xo += me.labelWidth(me.chart.__dataset.rowName(r))+30;
                });
                l.css({
                    position: 'relative'
                });
                $('#header', c.root.parent()).append(l);
            }
            $('.showOnHover').hide();

            if (me.theme.columnChart.cutGridLines) me.horzGrid();
        },

        getBarColor: function(series, row, useNegativeColor, colorful) {
            var me = this,
                main = series && useNegativeColor && series.data[row] < 0 ? 'negative' : 'main',
                hl = series && me.chart.hasHighlight() && me.chart.isHighlighted(series);

            return me.getSeriesColor(series || me.chart.dataSeries()[0], row, false, false);
        },

        initDimensions: function(r) {
            //
            var me = this, c = me.__canvas,
                dMin = 0, dMax = 0;
            _.each(me.chart.dataSeries(), function(series) {
                dMin = Math.min(dMin, series.min);
                dMax = Math.max(dMax, series.max);
            });
            me.__domain = [dMin, dMax];
            me.__scales = {
                y: d3.scale.linear().domain([dMin, dMax])
            };
            //                                                    v-- substract a few pixel to get space for the legend!
            me.__scales.y.rangeRound([0, c.h - c.bpad - c.tpad - 30]);
        },

        barDimensions: function(series, s, r) {
            var me = this,
                sc = me.__scales,
                c = me.__canvas,
                n = me.chart.dataSeries().length,
                w, h, x, y, i, cw, bw,
                pad = 0.35,
                vspace = 0.1;

            if (c.w / n < 30) vspace = 0.05;

            cw = (c.w - c.lpad - c.rpad) * (1 - vspace - vspace);
            bw = cw / (n + (n-1) * pad);
            h = sc.y(series.data[r]) - sc.y(0);
            w = Math.round(bw / series.data.length);
            if (h >= 0) {
                y = c.h - c.bpad - sc.y(0) - h;
            } else {
                y = c.h - c.bpad - sc.y(0);
                h *= -1;
            }
            x = Math.round((c.w - c.lpad - c.rpad) * vspace + c.lpad + s * (bw + bw * pad));
            return { w: w, h: h, x: x + Math.floor((w+1)*r), y: y, bx: x, bw: bw };
        },

        getDataRowByPoint: function(x, y) {
            return 0;
        },

        showTooltip: function() {

        },

        hideTooltip: function() {
            
        },

        horzGrid: function() {
            // draw tick marks and labels
            var me = this,
                yscale = me.__scales.y,
                c = me.__canvas,
                domain = me.__domain,
                styles = me.__styles,
                ticks = me.getYTicks(c.h, true);

            _.each(ticks, function(val, t) {
                var y = c.h - c.bpad - yscale(val), x = c.lpad, ly = y-10;
                if (val >= domain[0] && val <= domain[1]) {
                    // c.paper.text(x, y, val).attr(styles.labels).attr({ 'text-anchor': 'end' });
                    if (me.theme.columnChart.cutGridLines) ly += 10;
                    if (val !== 0) me.label(x+2, ly, me.formatValue(val, t == ticks.length-2, true), { align: 'left', cl: 'axis' });
                    if (me.theme.yTicks) {
                        me.path([['M', c.lpad-25, y], ['L', c.lpad-20,y]], 'tick');
                    }
                    if (me.theme.horizontalGrid) {
                        var l = me.path([['M', c.lpad, y], ['L', c.w - c.rpad,y]], 'grid')
                            .attr(me.theme.horizontalGrid);
                        if (val === 0) l.attr(me.theme.xAxis);
                        else if (me.theme.columnChart.cutGridLines) l.attr('stroke', me.theme.colors.background);
                    }
                }
            });
        },

        hoverSeries: function(series) {
            var me = this;
            _.each(me.chart.dataSeries(), function(s) {
                _.each(me.__seriesLabels[s.name], function(lbl) {
                    if (series !== undefined && s.name == series.name) {
                        lbl.addClass('hover');
                        if (lbl.hasClass('showOnHover')) lbl.show(0.5);
                    } else {
                        lbl.removeClass('hover');
                        if (lbl.hasClass('showOnHover')) lbl.hide(0.5);
                    }
                    _.each(me.__seriesElements[s.name], function(el) {
                        var fill = me.getBarColor(s, el.data('row'), me.get('negative-color', false)), stroke;
                        if (series !== undefined && s.name == series.name) fill = d3.cie.lch(d3.rgb(fill)).darker(0.6).toString();
                        stroke = d3.cie.lch(d3.rgb(fill)).darker(0.6).toString();
                        if (el.attrs.fill != fill || el.attrs.stroke != stroke)
                            el.animate({ fill: fill, stroke: stroke }, 50);
                    });
                });
            });
        },

        unhoverSeries: function() {
            this.hoverSeries();
        },

        formatValue: function() {
            return this.chart.formatValue.apply(this.chart, arguments);
        }
    });

}).call(this);