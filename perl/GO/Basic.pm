# $Id: Basic.pm,v 1.4 2005/03/30 21:15:48 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Basic     - basic procedural interface to go-perl

=head1 SYNOPSIS

  use GO::Basic;
  parse_obo(shift @ARGV);
  find_term(name=>"cytosol");
  print $term->acc();                 # OO usage
  print acc();                        # procedural usage
  get_parent;
  print name();
  

=head1 DESCRIPTION

=cut

package GO::Basic;

use Exporter;

use Carp;
use GO::Model::Graph;
use GO::Parser;
use FileHandle;
use strict;
use base qw(GO::Model::Root Exporter);
use vars qw(@EXPORT);

our $graph;
our $terms;
our $term;

@EXPORT =
  qw(
     parse
     parse_obo
     parse_goflat
     parse_def
     parse_assoc
     term
     terms
     acc
     accs
     name
     names
     graph
     find_term
     find_terms
     get_parents
     get_rparents
     get_children
     get_rchildren
    );

sub parse_obo { parse(@_, {fmt=>'obo'}) }
sub parse_goflat { parse(@_, {fmt=>'go_ont'}) }
sub parse_def { parse(@_, {fmt=>'go_def'}) }
sub parse_assoc { parse(@_, {fmt=>'go_assoc'}) }

sub parse {
    my $opt = {format=>'obo'};
    my @files =
      map {
          if (ref($_)) {
              if (ref($_) eq 'HASH') {
                  my %h = %$_;
                  $opt->{$_} = $h{$_} foreach keys %h;
              }
              else {
                  throw("bad argument: $_");
              }
              ();
          }
          else {
              $_;
          }
      } @_;
    my $parser = GO::Parser->new({format=>$opt->{fmt}, 
                                  use_cache=>$opt->{use_cache},
                                  handler=>'obj'});
    $parser->parse($_) foreach @files;
    $graph = $parser->handler->graph;
    $graph;
}

sub find_terms {
    @_ < 1 && throw("must pass an argument!");
    my %constr = @_==1 ? (name=>shift) : @_;
    check_for_graph();
    $terms = $graph->term_query(\%constr);
    return $terms;
}

sub find_term {
    find_terms(@_);
    if (@$terms) {
        if (@$terms > 1) {
            message(">1 terms returned!");
        }
        $term = $terms->[0];
        return $term;
    }
    return;
}

sub term {
    check_for_term();
    return $term;
}

sub terms {
    check_for_terms();
    return @$terms;
}

sub next_term {
    $term = shift @$terms;
}

sub graph {
    check_for_graph();
    return $graph;
}

sub acc {
    check_for_term();
    return $term->acc;
}

sub accs {
    check_for_terms();
    return map {$_->acc} @$terms;
}

sub name {
    check_for_term();
    return $term->name;
}

sub names {
    check_for_terms();
    return map {$_->name} @$terms;
}


sub definition {
    check_for_term();
    return $term->definition;
}

sub check_for_term {
    $term || throw("no term selected!");
}
sub check_for_terms {
    $terms || throw("no term set selected!");
}
sub check_for_graph {
    $graph || throw("no graph selected!");
}

sub get_parents {
    check_for_graph();
    check_for_term();
    $terms = $graph->get_parent_terms($term->acc);
}

sub get_rparents {
    check_for_graph();
    check_for_term();
    $terms = $graph->get_recursive_parent_terms($term->acc);
}

sub get_children {
    check_for_graph();
    check_for_term();
    $terms = $graph->get_child_terms($term->acc);
}

sub get_rchildren {
    check_for_graph();
    check_for_term();
    $terms = $graph->get_recursive_child_terms($term->acc);
}

sub throw {
    confess "@_";
}

sub message {
    print STDERR "@_\n";
}

1;
