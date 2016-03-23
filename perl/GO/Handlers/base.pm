# $Id: base.pm,v 1.5 2004/11/24 02:28:00 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::base     - 

=head1 SYNOPSIS

  use GO::Handlers::base

=cut

=head1 DESCRIPTION

Default Handler, other handlers inherit from this class

this class catches events (start, end and body) and allows the
subclassing module to intercept these. unintercepted events get pushed
into a tree

See GO::Parser for details on parser/handler architecture

=head1 PUBLIC METHODS - 

=cut

package GO::Handlers::base;

use strict;
use Exporter;
use Carp;
use GO::Model::Root;
use vars qw(@ISA @EXPORT_OK @EXPORT);
use base qw(Data::Stag::Writer Exporter);

@EXPORT_OK = qw(lookup);

sub EMITS    { () }
sub CONSUMES {
    qw(
       header
       source
       term
       typedef
       prod
      )
}

sub is_transform { 0 }

=head2 strictorder

  Usage   - $handler->strictorder(1);
  Returns -
  Args    -

boolean accessor; if set, then terms passed must be in order

=cut

sub strictorder {
    my $self = shift;
    $self->{_strictorder} = shift if @_;
    return $self->{_strictorder};
}

sub proddb {
    my $self = shift;
    $self->{_proddb} = shift if @_;
    return $self->{_proddb};
}

sub ontology_type {
    my $self = shift;
    $self->{_ontology_type} = shift if @_;
    return $self->{_ontology_type};
}

sub root_to_be_added {
    my $self = shift;
    $self->{_root_to_be_added} = shift if @_;
    return $self->{_root_to_be_added};
}



# DEPRECATED
sub messages {
    my $self = shift;
    $self->{_messages} = shift if @_;
    return $self->{_messages};
}

*error_list = \&messages;

sub message {
    my $self = shift;
    push(@{$self->messages},
         shift);
}


sub lookup {
    my $tree = shift;
    my $k = shift;
#    use Data::Dumper;
#    print Dumper $tree;
#    confess;
    if (!ref($tree)) {
        confess($tree);
    }
    my @v = map {$_->[1]} grep {$_->[0] eq $k} @$tree;
    if (wantarray) {
        return @v;
    }
    $v[0];
}


#sub print {
#    my $self = shift;
#    print "@_";
#}
sub print {shift->addtext(@_)}

sub printf {
    my $self = shift;
    my $fmt = shift;
    $self->addtext(sprintf($fmt, @_));
}

sub throw {
    my $self = shift;
    my @msg = @_;
    confess("@msg");
}
sub warn {
    my $self = shift;
    my @msg = @_;
    warn("@msg");
}

sub dbxref2str {
    my $self = shift;
    my $dbxref = shift;
    return
      $dbxref->sget_dbname . ':' . $dbxref->sget_acc;
}

sub xslt {
    my $self = shift;
    $self->{_xslt} = shift if @_;
    return $self->{_xslt};
}


1;
