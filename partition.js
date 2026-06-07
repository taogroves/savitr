var PartitionSavitr = function(game_board, options) {
  var settings = {
    shuffle: true
  };

  $.extend(settings, options);

  var numbers = ['one', 'two', 'three'];
  var colors = ['red', 'green', 'purple'];
  var shadings = ['empty', 'striped', 'solid'];
  var shapes = ['oval', 'squiggle', 'diamond'];
  var board_size = 18;
  var partition_candidates = 20;
  var group_classes = [
    'partition-set-1',
    'partition-set-2',
    'partition-set-3',
    'partition-set-4',
    'partition-set-5',
    'partition-set-6'
  ];

  var deck = [];
  var board_cards = [];
  var selected = [];
  var groups = [];
  var card_groups = {};
  var next_group_id = 0;
  var rng = Math.random;

  game_board.addClass('savitr partition-mode');

  function start() {
    selected = [];
    groups = [];
    card_groups = {};
    next_group_id = 0;
    deck = new_deck();
    rng = settings.shuffle ?
      new Math.seedrandom(typeof settings.shuffle === 'string' ? settings.shuffle + '-partition' : null) :
      Math.random;
    board_cards = generate_partition();

    game_board.html(draw_board());
    render_cards();
    update_status('Select three cards to make a set.');
    update_progress();
    $('.partition-card', game_board).off('click').click(card_click);
    $('.partition-reset', game_board).off('click').click(start);
  }

  function draw_board() {
    var main = $('<div class="main partition-main"></div>');
    var header = $('<div class="partition-header"></div>');
    header.append($('<div><h2 class="title">Partition</h2><p class="partition-seed"></p></div>'));
    header.append($('<button class="control partition-reset">Reset Puzzle</button>'));
    main.append(header);
    main.append($('<div class="partition-board" role="grid" aria-label="Partition puzzle"></div>'));
    main.append($('<div class="partition-footer"><span class="partition-message"></span><span class="partition-progress"></span></div>'));

    if (typeof settings.shuffle === 'string') {
      $('.partition-seed', main).text(format_display_date(settings.shuffle));
    }

    return main;
  }

  function render_cards() {
    var board = $('.partition-board', game_board);
    board.empty();

    board_cards.forEach(function(card, position) {
      var cell = $('<button type="button" class="partition-cell" role="gridcell"></button>');
      cell.attr('data-position', position);
      cell.attr('aria-label', card_label(card));
      var image = $('<img class="card partition-card" alt=""/>');
      image.attr('src', 'images/' + card_to_file_name(card) + '.png');
      cell.append(image);
      board.append(cell);
    });
  }

  function card_click() {
    var position = parseInt($(this).parent().attr('data-position'), 10);
    var group_id = card_groups[position];

    if (group_id !== undefined) {
      $('.partition-board', game_board).removeClass('partition-complete');
      break_group(group_id);
      add_to_draft(position);
      return;
    }

    var selected_index = selected.indexOf(position);
    if (selected_index >= 0) {
      selected.splice(selected_index, 1);
      update_selection();
      update_status(selected.length ? 'Choose ' + (3 - selected.length) + ' more.' : 'Select three cards to make a set.');
      return;
    }

    add_to_draft(position);
  }

  function add_to_draft(position) {
    if (selected.length === 3) selected = [];
    selected.push(position);
    update_selection();

    if (selected.length < 3) {
      update_status('Choose ' + (3 - selected.length) + ' more.');
      return;
    }

    var selected_cards = selected.map(function(selected_position) {
      return board_cards[selected_position];
    });

    if (is_set(selected_cards)) {
      complete_group(selected.slice());
    } else {
      $('.partition-cell.partition-selected', game_board).addClass('invalid-set');
      setTimeout(function() {
        $('.partition-cell', game_board).removeClass('invalid-set');
      }, 500);
      update_status('Those three are not a set. Click one to remove it, or choose another card to start over.');
    }
  }

  function complete_group(positions) {
    var group_id = next_group_id++;
    groups[group_id] = {
      positions: positions,
      color_index: next_available_color()
    };

    positions.forEach(function(position) {
      card_groups[position] = group_id;
    });

    selected = [];
    update_selection();
    update_groups();
    update_progress();

    if (active_group_count() === 6) {
      update_status('Solved! All 18 cards are partitioned into six sets.');
      $('.partition-board', game_board).addClass('partition-complete');
    } else {
      update_status('Set made. ' + (6 - active_group_count()) + ' to go.');
    }
  }

  function break_group(group_id) {
    var group = groups[group_id];
    var positions = group ? group.positions : [];
    positions.forEach(function(position) {
      delete card_groups[position];
    });
    groups[group_id] = null;
    update_groups();
    update_progress();
  }

  function update_selection() {
    $('.partition-cell', game_board).removeClass('partition-selected');
    selected.forEach(function(position) {
      partition_cell(position).addClass('partition-selected');
    });
  }

  function update_groups() {
    var cells = $('.partition-cell', game_board);
    cells.removeClass(group_classes.join(' '));
    cells.removeAttr('data-set-number');

    groups.forEach(function(group) {
      if (!group) return;
      var group_class = group_classes[group.color_index];
      group.positions.forEach(function(position) {
        partition_cell(position)
          .addClass(group_class)
          .attr('data-set-number', group.color_index + 1);
      });
    });
  }

  function update_status(message) {
    $('.partition-message', game_board).text(message);
  }

  function update_progress() {
    var count = active_group_count();
    $('.partition-progress', game_board).text(count + ' / 6 sets');
  }

  function active_group_count() {
    return groups.filter(function(group) {
      return group;
    }).length;
  }

  function next_available_color() {
    var used_colors = {};
    groups.forEach(function(group) {
      if (group) used_colors[group.color_index] = true;
    });

    for (var i = 0; i < group_classes.length; i++) {
      if (!used_colors[i]) return i;
    }

    throw new Error('No partition set color available.');
  }

  function partition_cell(position) {
    return $('.partition-cell[data-position="' + position + '"]', game_board);
  }

  function generate_partition() {
    var best_partition = null;
    var best_score = null;

    for (var candidate = 0; candidate < partition_candidates; candidate++) {
      var partition = generate_partition_candidate();
      var score = score_partition(partition);

      if (!best_score ||
          score.traps > best_score.traps ||
          (score.traps === best_score.traps && score.viable_sets < best_score.viable_sets) ||
          (score.traps === best_score.traps &&
           score.viable_sets === best_score.viable_sets &&
           score.total_sets > best_score.total_sets)) {
        best_partition = partition;
        best_score = score;
      }
    }

    return best_partition;
  }

  function generate_partition_candidate() {
    var attempts = 0;

    while (attempts < 1000) {
      attempts++;
      var available = deck.slice();
      var partition = [];

      shuffle_array(available, rng);

      while (partition.length < board_size && available.length >= 3) {
        var first = available.shift();
        var second_index = Math.floor(rng() * available.length);
        var second = available.splice(second_index, 1)[0];
        var third = completing_card(first, second);
        var third_index = card_index_in(third, available);

        if (third_index < 0) {
          break;
        }

        partition.push(first, second, available.splice(third_index, 1)[0]);
      }

      if (partition.length === board_size) {
        shuffle_array(partition, rng);
        return partition;
      }
    }

    throw new Error('Unable to generate a partition puzzle.');
  }

  function score_partition(partition) {
    var sets = sets_in_partition(partition);
    var sets_by_position = [];
    var full_mask = Math.pow(2, board_size) - 1;
    var completion_cache = {};

    for (var position = 0; position < board_size; position++) {
      sets_by_position[position] = [];
    }

    sets.forEach(function(set, set_index) {
      set.positions.forEach(function(position) {
        sets_by_position[position].push(set_index);
      });
    });

    function can_complete(used_mask) {
      if (used_mask === full_mask) return true;
      if (Object.prototype.hasOwnProperty.call(completion_cache, used_mask)) {
        return completion_cache[used_mask];
      }

      var first_unused = 0;
      while ((used_mask & Math.pow(2, first_unused)) !== 0) {
        first_unused++;
      }

      var candidate_sets = sets_by_position[first_unused];
      for (var i = 0; i < candidate_sets.length; i++) {
        var set_mask = sets[candidate_sets[i]].mask;
        if ((set_mask & used_mask) === 0 && can_complete(used_mask | set_mask)) {
          completion_cache[used_mask] = true;
          return true;
        }
      }

      completion_cache[used_mask] = false;
      return false;
    }

    var traps = 0;
    var viable_sets = 0;
    sets.forEach(function(set) {
      if (can_complete(set.mask)) {
        viable_sets++;
      } else {
        traps++;
      }
    });

    return {
      traps: traps,
      viable_sets: viable_sets,
      total_sets: sets.length
    };
  }

  function sets_in_partition(partition) {
    var sets = [];

    for (var i = 0; i < partition.length; i++) {
      for (var j = i + 1; j < partition.length; j++) {
        for (var k = j + 1; k < partition.length; k++) {
          if (is_set([partition[i], partition[j], partition[k]])) {
            sets.push({
              positions: [i, j, k],
              mask: Math.pow(2, i) | Math.pow(2, j) | Math.pow(2, k)
            });
          }
        }
      }
    }

    return sets;
  }

  function completing_card(first, second) {
    return {
      number: completing_value(first.number, second.number, numbers),
      color: completing_value(first.color, second.color, colors),
      shading: completing_value(first.shading, second.shading, shadings),
      shape: completing_value(first.shape, second.shape, shapes)
    };
  }

  function completing_value(first, second, values) {
    var first_index = values.indexOf(first);
    var second_index = values.indexOf(second);
    var third_index = (3 - ((first_index + second_index) % 3)) % 3;
    return values[third_index];
  }

  function card_index_in(card, cards) {
    for (var i = 0; i < cards.length; i++) {
      if (cards_equal(card, cards[i])) return i;
    }
    return -1;
  }

  function cards_equal(first, second) {
    return first.number === second.number &&
      first.color === second.color &&
      first.shading === second.shading &&
      first.shape === second.shape;
  }

  function is_set(three_cards) {
    return feature_is_set(three_cards, 'number') &&
      feature_is_set(three_cards, 'color') &&
      feature_is_set(three_cards, 'shading') &&
      feature_is_set(three_cards, 'shape');
  }

  function feature_is_set(cards, feature) {
    var unique_values = {};
    cards.forEach(function(card) {
      unique_values[card[feature]] = true;
    });
    return Object.keys(unique_values).length !== 2;
  }

  function new_deck() {
    var cards = [];
    numbers.forEach(function(number) {
      colors.forEach(function(color) {
        shadings.forEach(function(shading) {
          shapes.forEach(function(shape) {
            cards.push({
              number: number,
              color: color,
              shading: shading,
              shape: shape
            });
          });
        });
      });
    });
    return cards;
  }

  function card_to_file_name(card) {
    var number_code = {one: '1', two: '2', three: '3'};
    var color_code = {red: 'R', green: 'G', purple: 'P'};
    var shading_code = {empty: 'O', striped: 'S', solid: 'F'};
    var shape_code = {oval: 'O', squiggle: 'S', diamond: 'D'};
    return number_code[card.number] + color_code[card.color] + shading_code[card.shading] + shape_code[card.shape];
  }

  function card_label(card) {
    return card.number + ' ' + card.color + ' ' + card.shading + ' ' + card.shape;
  }

  function format_display_date(iso_date) {
    var date = new Date(iso_date + 'T12:00:00');
    if (isNaN(date.getTime())) return iso_date;
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  function shuffle_array(array, random) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var temporary = array[i];
      array[i] = array[j];
      array[j] = temporary;
    }
  }

  return {start: start};
};
