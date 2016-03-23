# $Id: Root.pm,v 1.6 2007/08/07 21:43:37 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Model::Root;

=head1 NAME

  GO::Model::Root

=head1 DESCRIPTION

base class for all GO::Model objects

=cut

use strict;
use Carp;
use Exporter;
use Data::Dumper;
use vars qw(@ISA $AUTOLOAD);

my @ISA = qw(Exporter);


# - - - - - - - - - - Public functions - - - - - - - - - - - - 

=head1 Constructors

=head2 new

Constructor: Basically just calls L<_initialize>().  Most subclasses
should not need to override new, but instead should override
L<_initialize>().

If L<_initialize>() fails , the procedure will die

WARNING: This procedure will die if initialization is unsuccessful.  
Use an eval statement to catch such exceptions.

=cut

sub new 
{
    my $proto = shift; my $class = ref($proto) || $proto;;
    my $self = {};
    bless $self, $class;

    $self->_initialize(@_);

    if ($ENV{PERL_MEMORY_TRACE}) {
	print STDERR "NEW: ".$self->sprint_self."\n";
    }
    return $self;
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

=head2 obj_factory

  Usage   - $obj->obj_factory->create_new_term_object($h);
  Alias   - apph
  Returns - L<GO::ObjFactory>
  Args    - none

=cut

sub apph {
    my $self = shift;
    $self->{apph} = shift if @_;
    return $self->{apph};
}
*obj_factory = \&apph;


=head2 sprint_self

Prints out a description of the object to a string.

=cut

sub sprint_self
  {
    my $self = shift;
    my $str = $self;
    if ($self->can("name") && $self->name) {
	$str.= " ".$self->name;
    }
    return $str;
  }


=head2 dump

dumps the object (can be read back in with eval)

=cut

sub dump {
    my $self = shift;
    my $ob = shift || $self;
    my $d = Data::Dumper->new(["obj", $ob]);
    return $d->Dump;
}

sub _initialize 
{

    my $self = shift;
    $self->init if $self->can("init");
    my @valid_params = $self->_valid_params;
    my ($paramh) = @_; # first arg

    # arguments passed as hash?
    if (ref($paramh)) {
        map {
            if (defined($paramh->{$_})) {
                $self->$_($paramh->{$_});
            }
        } @valid_params;
    }
    else {
        # arguments passed as array
        for (my $i=0; $i<@_; $i++) {
            my $m = $valid_params[$i];
            $self->$m($_[$i]);
        }
    }
}

sub _valid_params {
    ();
}

sub is_valid_param {
    my $self = shift;
    my $param = shift;
    return scalar(grep {$_ eq $param} $self->_valid_params);
}

sub id {
    my $self = shift;
    $self->{id} = shift if @_;
    return $self->{id};
}


=head2 namespace

  Usage   - print $term->namespace();     # getting the type
  Usage   - $term->namespace("molecular_function"); # setting the type
  Alias   - type
  Alias   - term_type
  Alias   - category
  Alias   - ontology
  Returns - string representing type
  Args    - string represnting type [optional]

The OBO namespace for the L<GO::Model::Term> or
L<GO::Model::Relationship>

=cut

sub namespace {
    my $self = shift;
    $self->{namespace} = shift if @_;
    return $self->{namespace};
}
# synonyms
sub term_type { shift->namespace(@_) }
sub category { shift->namespace(@_) }
sub ontology { shift->namespace(@_) }
sub type { shift->namespace(@_) }



=head2 _cleanup

Called at object destruction time.  Should be overridden to perform
cleanup tasks.

=cut

#sub _cleanup
#{
#  my $self = shift;

#  # The best we can do here is clean up references left 
#  # in our hash table.  We'll also drop debugging alerts.
#  my $attribute;
#  foreach $attribute (keys %$self)
#    {
#      if(ref($self->{$attribute})) 
#	{
#	  undef $self->{$attribute};
#	}
#    }
#}


sub _initialize_attributes {

    my $self = shift;
    my @att_name_arr = @{shift || []};
    my $param_ref = shift;
    my @param = @{$param_ref};


    if (defined($param[0]) && $param[0]=~/^-/) {
	
	# attributes specified as '-key=>val' list

	my $i;
	for ($i=0;$i<@param;$i+=2) {
	    $param[$i]=~tr/A-Z/a-z/;
	}
	
	# Now we'll convert the @params variable into an associative array.
	my(%param) = @param;

	my(@return_array);
	my $key;
	foreach $key (@att_name_arr) {
	    my $orig_key = $key;
	    $key=~tr/A-Z/a-z/;
	    if (defined($param{"-".$key})) {
		my($value) = $param{"-".$key};
		delete $param{"-".$key};
		$self->{"_$orig_key"} = $value;
	    }
	}
  
	# catch user misspellings resulting in unrecognized names
	my(@restkeys) = keys %param;

	@{$param_ref} = %param;
	if (scalar(@restkeys) > 0) {
######	    carp("@restkeys not processed in _rearrange(), did you use a non-recognized parameter name ? ");
	}
	
    }
    else {
	# attributes specified as basic array
	my $i;
	for ($i=0; $i<@param; $i++) {
	    if ($i >= @att_name_arr) {
		confess("Too many params");
	    }
	    my $att_name = $att_name_arr[$i];
	    $self->{"_$att_name"} = $param[$i];
	}
    }
	
}

sub from_idl {
    my $class = shift;
    my $h = shift;
    foreach my $k (%$h) {
	if (ref($h->{$k}) eq "HASH") {
	    confess("must be dealth with in subclass of this");
	}
    }
    return $class->new($h);
}

sub to_prolog {
    my $self = shift;
    my @t = $self->to_ptuples(@_);
    my @s =
    map {
        sprintf("%s(%s).\n",
                shift @$_,
                join(", ",
                     map {$self->prolog_quote($_)} @$_
                    ));
    } @t;
    my %h=();
    # uniquify
    @s = grep {(!$h{$_}) and ($h{$_} = 1)} @s;
    return join("", @s);
}

sub prolog_quote {
    my $self = shift;
    my $s = shift;
    $s = '' unless defined $s;
    $s =~ s/\'/\\\'/g;
    "'$s'";
}



# auto-declare accessors

sub AUTOLOAD {
    
    my $self = shift;
 
    my $name = $AUTOLOAD;
    $name =~ s/.*://;   # strip fully-qualified portion

    if ($name eq "DESTROY") {
	# we dont want to propagate this!!
	return;
    }

    confess("$self") unless ref($self);
    
    my $add;
    if ($name =~ /add_(.+)/) {
        $add = $1."_list";
    }

    if ($self->can($name)) {
	confess("assertion error!");
    }
    if ($self->is_valid_param($name)) {
	
	$self->{$name} = shift if @_;
	return $self->{$name};
    }
    if ($add && $self->is_valid_param($add)) {
	push(@{$self->{$add}}, @_);
	return $self->{$add};
    }
    else {
	confess("can't do $name on $self");
    }
    
}




1;
